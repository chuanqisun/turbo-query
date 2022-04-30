import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { WorkerClient } from "../ipc/client";
import { IndexChangedUpdate } from "../service/emitters/index-manager";
import { RecentItemsChangedUpdate } from "../service/emitters/recent-content-manager";
import { RecentItemsResponse } from "../service/handlers/handle-get-recent";
import { SearchRequest, SearchResponse } from "../service/handlers/handle-search";
import { SyncRequest, SyncResponse } from "../service/handlers/handle-sync";
import { SyncMetadataRequest } from "../service/handlers/handle-sync-metadata";
import { DisplayItem } from "../service/utils/get-display-item";
import { getSummaryMessage } from "../service/utils/get-summary-message";
import { useConfigGuard } from "./components/hooks/use-config-guard";
import { useClickToSelect, useHandleEscapeGlobal, useHandleIconClick, useHandleIconCopy, useHandleLinkClick } from "./components/hooks/use-event-handlers";
import { useIsOffline } from "./components/hooks/use-is-offline";
import { useRecursiveTimer } from "./components/hooks/use-recursive-timer";
import { selectElementContent } from "./components/utils/dom";

const pollingInterval = 5;
const worker = new Worker("./modules/service/worker.js");
const workerClient = new WorkerClient(worker);

export const PopupWindow: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchResult, setSearchResult] = useState<DisplayItem[]>();
  const [progressMessage, setProgressMessage] = useState<null | string>(null);
  const [indexRev, setIndexRev] = useState<number | null>(null);

  const initialQuery = useRef(localStorage.getItem("last-query") ?? "");
  const [activeQuery, setActiveQuery] = useState(initialQuery.current);

  const isOffline = useIsOffline();

  const setTimestampMessage = useCallback((message: string) => setProgressMessage(`${new Date().toLocaleTimeString()} ${message}`), []);

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
    document.querySelector(".js-scroll")?.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    setTimestampMessage(isOffline ? "System offline" : "System online");
  }, [isOffline]);

  const [recentItems, setRecentItems] = useState<any[] | null>(null);

  // watch for index updates
  useEffect(() => workerClient.subscribe<IndexChangedUpdate>("index-changed", (update) => setIndexRev(update.rev)), []);

  // watch for recent content
  const [isRecentQueryLive, setIsRecentQueryLive] = useState(false);

  useEffect(() => {
    if (isRecentQueryLive) return;
    if (!activeQuery.trim().length) {
      console.log(`[recent] Start watching...`);
      workerClient.post<any, RecentItemsResponse>("recent-items", {}).then((response) => setRecentItems(response.items)); // initial query
      workerClient.subscribe<RecentItemsChangedUpdate>("recent-items-changed", (update) => setRecentItems(update.recentItems)); // updates
      setIsRecentQueryLive(true);
    }
  }, [isRecentQueryLive, activeQuery]);

  const requestSync = useCallback(
    async (rebuildIndex?: boolean) => {
      if (!config) return;
      await workerClient.post<SyncRequest, SyncResponse>("sync", { config, rebuildIndex }).then((summary) => {
        setTimestampMessage(getSummaryMessage(summary));
      });
    },
    [config]
  );

  const requestSyncMetadata = useCallback(async () => {
    if (!config) return;
    await workerClient.post<SyncMetadataRequest, any>("sync-metadata", { config }).then(() => {
      setTimestampMessage("Metadata updated");
    });
  }, [config]);

  // polling sync
  // TODO perform full sync when network goes online the first time
  useRecursiveTimer(requestSync, isOffline || !config ? null : pollingInterval * 1000);
  useEffect(() => {
    if (!config) return;

    requestSync(true);
    requestSyncMetadata();
  }, [config]); // start initial sync now

  // recent
  useEffect(() => {
    if (!recentItems) return;
    if (activeQuery.trim().length) return;

    setSearchResult(recentItems);
  }, [recentItems, activeQuery]);

  // search
  useEffect(() => {
    if (!activeQuery.trim().length) return;
    if (indexRev === null) return;

    workerClient.post<SearchRequest, SearchResponse>("search", { query: activeQuery }).then((response) => {
      setSearchResult(response.items);
    });
  }, [indexRev, activeQuery]);

  const openConfig = useCallback(() => {
    chrome.runtime.openOptionsPage();
  }, []);

  const handleTextFocus = useCallback<React.FocusEventHandler>((e: React.FocusEvent<HTMLSpanElement>) => selectElementContent(e.target as HTMLSpanElement), []);
  const handleTextBlur = useCallback<React.FocusEventHandler>((_e: React.FocusEvent<HTMLSpanElement>) => window.getSelection()?.removeAllRanges(), []);

  const handleClickToSelect = useClickToSelect();

  const handleLinkClick = useHandleLinkClick({ isPopup: true });
  const handleIconClick = useHandleIconClick();
  const handleIconCopy = useHandleIconCopy();

  useHandleEscapeGlobal(inputRef);

  return config ? (
    <div className="stack-layout">
      <div className="query-bar">
        <div className="query-bar__input-group">
          <button onClick={openConfig}>⚙️</button>
          <input
            className="query-bar__input"
            ref={inputRef}
            type="search"
            autoFocus
            value={activeQuery}
            onChange={handleInputChange}
            placeholder="Search by title or field values…"
          />
        </div>
      </div>

      <ul className="work-item-list">
        {searchResult === undefined && <li className="work-item">Initializing...</li>}
        {searchResult?.length === 0 && <li className="work-item">No result</li>}
        {searchResult?.map((item) => (
          <li className="work-item" key={item.id}>
            <span
              className="work-item__state-bar"
              data-state-category={item.stateCategory}
              style={{ "--state-color": item.stateColor } as React.CSSProperties}
              title={item.state}
            ></span>
            <a
              tabIndex={-1}
              className="u-visually-hidden js-copy-target"
              href={`https://dev.azure.com/${config!.org}/${config!.project}/_workitems/edit/${item.id}`}
            >
              {item.workItemType} {item.id}: {item.title}
            </a>
            <span className="work-item__icon-interaction js-select-item-start" onClick={handleIconClick} title={item.workItemType}>
              {item.iconUrl ? (
                <img className="work-item__icon" src={item.iconUrl} alt={item.workItemType} width={16} height={16} />
              ) : (
                <div className="work-item__icon" />
              )}
              <span onCopy={handleIconCopy} className="u-visually-hidden">
                {item.workItemType}
              </span>
            </span>
            <div className="work-item__label-list">
              <span
                className="work-item__id work-item__matchable"
                data-matched={item.isIdMatched}
                tabIndex={0}
                onFocus={handleTextFocus}
                onBlur={handleTextBlur}
                onClick={handleClickToSelect}
              >
                {item.id}
              </span>{" "}
              <a
                className="work-item__link js-select-item-end"
                target="_blank"
                onClick={handleLinkClick}
                onFocus={handleTextFocus}
                onBlur={handleTextBlur}
                href={`https://dev.azure.com/${config!.org}/${config!.project}/_workitems/edit/${item.id}`}
              >
                {item.title}
              </a>{" "}
              {item.tags.length > 0 &&
                item.tags.map((tag, i) => (
                  <React.Fragment key={i}>
                    <span onClick={handleClickToSelect} className="work-item__tag work-item__matchable" title={tag} data-matched={item.isTagMatched?.[i]}>
                      <span className="work-item__tag-overflow-guard">{tag}</span>
                    </span>{" "}
                  </React.Fragment>
                ))}
              <span className="work-item__state work-item__matchable" data-matched={item.isStateMatched}>
                {item.state}
              </span>
              {" · "}
              <span className="work-item__type work-item__matchable" data-matched={item.isWorkItemTypeMatched}>
                {item.workItemType}
              </span>
              {" · "}
              <span className="work-item__assigned-to work-item__matchable" data-matched={item.isAssignedToUserMatched}>
                {item.assignedTo.displayName}
              </span>
              {" · "}
              <span className="work-item__path work-item__matchable" data-matched={item.isShortIterationPathMatched}>
                {item.shortIterationPath}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <output className="status-bar">{progressMessage}</output>
    </div>
  ) : null;
};

ReactDOM.render(
  <React.StrictMode>
    <PopupWindow />
  </React.StrictMode>,
  document.getElementById("root")
);
