import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { WorkerClient } from "../ipc/client";
import { RecentChangedUpdate } from "../service/emitters/recent-manager";
import { SearchChangedUpdate } from "../service/emitters/search-manager";
import { SearchRequest, SearchResponse } from "../service/handlers/handle-watch-search";
import { DisplayItem } from "../service/utils/get-display-item";
import { VirutalWorkItem } from "./components/work-item";
import { useConfigGuard } from "./hooks/use-config-guard";
import { useDebounce } from "./hooks/use-debounce";
import {
  useClickToSelect,
  useHandleEscapeGlobal,
  useHandleIconClick,
  useHandleIconCopy,
  useHandleLinkClick,
  useHandleTextBlur,
  useHandleTextFocus,
} from "./hooks/use-event-handlers";
import { useSync } from "./hooks/use-sync";

const DEBOUNCE_TIMEOUT = 25; // TODO: debounce + search latency should be less than 100ms for "instant" perception
const worker = new Worker("./modules/service/worker.js");
const workerClient = new WorkerClient(worker);

export const PopupWindow: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLUListElement>(null);
  const [searchResult, setSearchResult] = useState<DisplayItem[]>();
  const [progressMessage, setProgressMessage] = useState<null | string>(null);

  const initialQuery = useRef(localStorage.getItem("last-query") ?? "");
  const [activeQuery, setActiveQuery] = useState(initialQuery.current);

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
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, []);

  // const debouncedQuery = activeQuery;
  const debouncedQuery = useDebounce(activeQuery, DEBOUNCE_TIMEOUT);

  const [recentItems, setRecentItems] = useState<DisplayItem[] | null>(null);

  // watch for search updates
  useEffect(
    () =>
      workerClient.subscribe<SearchChangedUpdate>("search-changed", (update) => {
        // accept update only when search box has content
        if (inputRef.current?.value?.trim().length) {
          setSearchResult(update.items);
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
      setSearchResult(recentItems);
    }
  }, [recentItems, activeQuery]);

  // request search on every query change
  useEffect(() => {
    if (!debouncedQuery.trim().length) return;

    workerClient.post<SearchRequest, SearchResponse>("watch-search", { query: debouncedQuery }).then((result) => {
      setSearchResult(result.items);
    });
  }, [debouncedQuery]);

  // request recent on first blank query
  const [isRecentQueryLive, setIsRecentQueryLive] = useState(false);
  useEffect(() => {
    if (isRecentQueryLive) return;
    if (!debouncedQuery.trim().length) {
      workerClient.post("watch-recent", {});
      setIsRecentQueryLive(true);
    }
  }, [isRecentQueryLive, debouncedQuery]);

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

      <ul className="work-item-list" ref={scrollContainerRef}>
        {searchResult === undefined && <li className="work-item">Waiting for data...</li>}
        {searchResult?.length === 0 && <li className="work-item">No result</li>}
        {searchResult?.map((item, index) => (
          <VirutalWorkItem
            key={item.id}
            forceVisible={index < 15 || index === searchResult?.length - 1} // support backward tabbing
            rootElement={scrollContainerRef.current!}
            config={config}
            item={item}
            placeholderClassName="work-item__placeholder"
            handleClickToSelect={handleClickToSelect}
            handleIconClick={handleIconClick}
            handleIconCopy={handleIconCopy}
            handleLinkClick={handleLinkClick}
            handleTextBlur={handleTextBlur}
            handleTextFocus={handleTextFocus}
          />
        ))}
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
