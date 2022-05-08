import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { WorkerClient } from "../ipc/client";
import { RecentChangedUpdate } from "../service/emitters/recent-manager";
import { SearchChangedUpdate } from "../service/emitters/search-manager";
import { SearchRequest, SearchResponse } from "../service/handlers/handle-watch-search";
import { DisplayItem } from "../service/utils/get-display-item";
import { useConfigGuard } from "./hooks/use-config-guard";
import { useDebounce } from "./hooks/use-debounce";
import {
  useClickToSelect,
  useHandleEscapeGlobal,
  useHandleIconClick,
  useHandleLinkClick,
  useHandleQueryKeydown,
  useHandleSentinelFocus,
  useHandleTextBlur,
  useHandleTextFocus,
} from "./hooks/use-event-handlers";
import { useKeyboardNavigatioe } from "./hooks/use-keyboard-navigation";
import { useSync } from "./hooks/use-sync";
import { useVirtualList } from "./hooks/use-virtual-list";
import { copyDataHtml } from "./utils/clipboard";

const DEBOUNCE_TIMEOUT = 25; // TODO: debounce + search latency should be less than 100ms for "instant" perception
const worker = new Worker("./modules/service/worker.js");
const workerClient = new WorkerClient(worker);

export const PopupWindow: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>();
  const [progressMessage, setProgressMessage] = useState<null | string>(null);

  const initialQuery = useRef(localStorage.getItem("last-query") ?? "");
  const [activeQuery, setActiveQuery] = useState(initialQuery.current);

  const setTimestampMessage = useCallback((message: string) => setProgressMessage(`${new Date().toLocaleTimeString()}\xa0 ${message}`), []); // with non-breaking space

  const config = useConfigGuard(() => {
    chrome.runtime.openOptionsPage();
    setTimestampMessage("Please complete the setup first");
  });

  useEffect(() => {
    if (!config) return;

    if (initialQuery.current.length) {
      console.log(`[input] Auto-selected last used query`);
      inputRef.current?.select();
    }
  }, [config]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setActiveQuery(e.target.value);
    localStorage.setItem("last-query", e.target.value);
    virtualListRef.current?.scrollTo({ top: 0 });
  }, []);

  const debouncedQuery = useDebounce(activeQuery, DEBOUNCE_TIMEOUT);

  const [recentItems, setRecentItems] = useState<DisplayItem[] | null>(null);

  // watch for search updates
  useEffect(
    () =>
      workerClient.subscribe<SearchChangedUpdate>("search-changed", (update) => {
        // accept update only when search box has content
        if (inputRef.current?.value?.trim().length) {
          setDisplayItems(update.items);
        }
      }),
    []
  );

  // watch for recent updates
  useEffect(
    () =>
      workerClient.subscribe<RecentChangedUpdate>("recent-changed", (update) => {
        // accept update only when search box is empty
        if (!inputRef.current?.value?.trim().length) {
          setRecentItems(update.recentItems);
        }
      }),
    []
  );
  // display recent as search results when search box is empty
  useEffect(() => {
    if (!activeQuery.trim().length && recentItems) {
      setDisplayItems(recentItems);
    }
  }, [recentItems, activeQuery]);

  // request search on every query change
  useEffect(() => {
    if (!debouncedQuery.trim().length) return;

    workerClient.post<SearchRequest, SearchResponse>("watch-search", { query: debouncedQuery }).then((result) => {
      // accept results only when search box has content
      if (inputRef.current?.value?.trim().length) {
        setDisplayItems(result.items);
      }
    });
  }, [debouncedQuery]);

  // request recent on first blank query
  const [isWatchingRecent, setIsWatchingRecent] = useState(false);
  useEffect(() => {
    if (isWatchingRecent) return;
    if (!debouncedQuery.trim().length) {
      workerClient.post("watch-recent", {});
      setIsWatchingRecent(true);
    }
  }, [isWatchingRecent, debouncedQuery]);

  // start polling sync
  const { errors } = useSync({
    config,
    setMessage: setTimestampMessage,
    workerClient,
  });

  const openConfig = useCallback(() => {
    chrome.runtime.openOptionsPage();
  }, []);

  const handleTextFocus = useHandleTextFocus();
  const handleTextBlur = useHandleTextBlur();
  const handleClickToSelect = useClickToSelect();
  const handleLinkClick = useHandleLinkClick();
  const handleIconClick = useHandleIconClick();
  const handleSentinelFocus = useHandleSentinelFocus();

  useHandleEscapeGlobal(inputRef);
  const { activeIndex, handleArrowKeys } = useKeyboardNavigatioe({ inputRef, displayItems });

  const handleQueryKeyDown = useHandleQueryKeydown({ activeIndex, config, displayItems });

  const { VirtualListItem, setVirtualListRef, virtualListRef } = useVirtualList();

  return config ? (
    <div className="stack-layout" onKeyDown={handleArrowKeys}>
      <div className="query-bar">
        <div className="query-bar__input-group">
          <button type="button" onClick={openConfig}>
            ⚙️
          </button>
          <input
            className="query-bar__input"
            ref={inputRef}
            type="search"
            autoFocus
            value={activeQuery}
            onChange={handleInputChange}
            onKeyDown={handleQueryKeyDown}
            placeholder="Search by title or fields…"
          />
        </div>
      </div>

      <ul className="work-item-list" ref={setVirtualListRef}>
        {displayItems === undefined && <li className="work-item work-item--message">Waiting for data...</li>}
        {displayItems?.length === 0 && <li className="work-item work-item--message">No result found</li>}
        {displayItems?.map((item, index) => {
          const itemUrl = `https://dev.azure.com/${config!.org}/${config!.project}/_workitems/edit/${item.id}`;
          const isActive = index === activeIndex;

          return (
            <VirtualListItem key={item.id} forceVisible={index < 15 || index === displayItems?.length - 1} placeholderClassName="work-item__placeholder">
              <li className="work-item" key={item.id} tabIndex={-1} data-item-active={isActive}>
                <span className="work-item__state-interaction" title={`State: ${item.state}`}>
                  <span
                    className="work-item__state-bar"
                    data-state-category={item.stateCategory}
                    style={{ "--state-color": item.stateColor } as React.CSSProperties}
                  />
                </span>
                <span
                  onCopy={copyDataHtml}
                  className="work-item__icon-interaction js-select-item-trigger js-select-item-start"
                  onClick={handleIconClick}
                  data-copy-html={`<a href="${itemUrl}">${item.workItemType} ${item.id}: ${item.title}</a>`}
                  title={`Type: ${item.workItemType} (Click to select type + ID + title)`}
                >
                  {item.iconUrl ? (
                    <img className="work-item__icon" src={item.iconUrl} alt={item.workItemType} width={16} height={16} />
                  ) : (
                    <div className="work-item__icon" />
                  )}
                </span>
                <div className="work-item__label-list">
                  <span
                    className="work-item__id work-item__matchable"
                    data-matched={item.isIdMatched}
                    tabIndex={isActive ? 0 : -1}
                    title={`ID: ${item.id} (Click to select)`}
                    data-copy-html={`<a href="${itemUrl}">${item.id}</a>`}
                    onFocus={handleTextFocus}
                    onBlur={handleTextBlur}
                    onCopy={copyDataHtml}
                    onClick={handleClickToSelect}
                  >
                    {item.id}
                  </span>{" "}
                  <span tabIndex={isActive ? 0 : -1} onFocus={handleSentinelFocus}></span>
                  <a
                    className="work-item__link js-select-item-end"
                    target="_blank"
                    tabIndex={isActive ? 0 : -1}
                    onClick={handleLinkClick}
                    onFocus={handleTextFocus}
                    onBlur={handleTextBlur}
                    onCopy={copyDataHtml}
                    data-copy-html={`<a href="${itemUrl}">${item.title}</a>`}
                    title={`Title: ${item.title} (Click to open, Alt + click to select)`}
                    href={itemUrl}
                    dangerouslySetInnerHTML={{ __html: item.titleHtml }}
                  />{" "}
                  {item.tags.length > 0 &&
                    item.tags.map((tag, i) => (
                      <React.Fragment key={i}>
                        <span className="work-item__tag work-item__matchable" title={`Tag: ${tag}`} data-matched={item.isTagMatched?.[i]}>
                          <span className="work-item__tag-overflow-guard">{tag}</span>
                        </span>{" "}
                      </React.Fragment>
                    ))}
                  <span className="work-item__state work-item__matchable" title={`State: ${item.state}`} data-matched={item.isStateMatched}>
                    {item.state}
                  </span>
                  &nbsp;{"· "}
                  <span className="work-item__type work-item__matchable" title={`Type: ${item.workItemType}`} data-matched={item.isWorkItemTypeMatched}>
                    {item.workItemType}
                  </span>
                  &nbsp;{"· "}
                  <span
                    className="work-item__assigned-to work-item__matchable"
                    title={`Assigned to: ${item.assignedTo.displayName}`}
                    data-matched={item.isAssignedToUserMatched}
                  >
                    {item.assignedTo.displayName}
                  </span>
                  &nbsp;{"· "}
                  <span
                    className="work-item__path work-item__matchable"
                    title={`Iteration: ${item.iterationPath}`}
                    data-matched={item.isShortIterationPathMatched}
                  >
                    {item.shortIterationPath}
                  </span>
                </div>
              </li>
            </VirtualListItem>
          );
        })}
      </ul>

      {errors.length ? (
        <output className="status-bar status-bar--error">
          {progressMessage}{" "}
          <a href="#" className="status-bar__action" onClick={openConfig}>
            Fix problems in options page
          </a>
        </output>
      ) : (
        <output className="status-bar">{progressMessage}</output>
      )}
    </div>
  ) : null;
};

ReactDOM.render(
  <React.StrictMode>
    <PopupWindow />
  </React.StrictMode>,
  document.getElementById("root")
);
