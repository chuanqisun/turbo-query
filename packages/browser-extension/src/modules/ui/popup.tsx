import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { WorkerClient } from "../ipc/client";
import { RecentChangedUpdate } from "../service/emitters/recent-manager";
import { SearchChangedUpdate } from "../service/emitters/search-manager";
import { SyncContentRequest, SyncContentResponse, SyncContentUpdate } from "../service/handlers/handle-sync-content";
import { SyncMetadataRequest, SyncMetadataResponse, SyncMetadataUpdate } from "../service/handlers/handle-sync-metadata";
import { SearchRequest } from "../service/handlers/handle-watch-search";
import { DisplayItem } from "../service/utils/get-display-item";
import { useConfigGuard } from "./components/hooks/use-config-guard";
import { useDebounce } from "./components/hooks/use-debounce";
import { useClickToSelect, useHandleEscapeGlobal, useHandleIconClick, useHandleIconCopy, useHandleLinkClick } from "./components/hooks/use-event-handlers";
import { useIsOffline } from "./components/hooks/use-is-offline";
import { useRecursiveTimer } from "./components/hooks/use-recursive-timer";
import { selectElementContent } from "./components/utils/dom";

const POLLING_INTERVAL = 5;
const DEBOUNCE_INTERVAL = 100;
const worker = new Worker("./modules/service/worker.js");
const workerClient = new WorkerClient(worker);

export const PopupWindow: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchResult, setSearchResult] = useState<DisplayItem[]>();
  const [progressMessage, setProgressMessage] = useState<null | string>(null);
  const [errors, setErrors] = useState<string[]>([]);

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
  const debouncedQuery = useDebounce(activeQuery, DEBOUNCE_INTERVAL);

  useEffect(() => {
    setTimestampMessage(isOffline ? "System offline" : "System online");
  }, [isOffline]);

  const [recentItems, setRecentItems] = useState<any[] | null>(null);
  const [searchItems, setSearchItems] = useState<any[] | null>(null);

  // watch for search updates
  useEffect(
    () =>
      workerClient.subscribe<SearchChangedUpdate>("search-changed", (update) => {
        setSearchItems(update.items);
      }),
    []
  );

  // watch for recent updates
  useEffect(() => workerClient.subscribe<RecentChangedUpdate>("recent-changed", (update) => setRecentItems(update.recentItems)), []);

  // request search on every query change
  useEffect(() => {
    if (!debouncedQuery.trim().length) return;

    workerClient.post<SearchRequest, void>("watch-search", { query: debouncedQuery });
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

  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);
  const requestSync = useCallback(async () => {
    if (!config) return;
    if (!navigator.onLine) return;

    let initialSyncPendingTasks = 2;

    if (!isInitialSyncDone) {
      function onInitialSyncTaskSuccess() {
        initialSyncPendingTasks--;
        if (initialSyncPendingTasks === 0) {
          setIsInitialSyncDone(true);
          setErrors([]);
        }
      }

      function contentProgressObserver(update: SyncContentUpdate) {
        switch (update.type) {
          case "progress":
            if (errors.length) return; // don't override existing errors
            setTimestampMessage(update.message);
            break;
          case "success":
            setTimestampMessage(update.message);
            onInitialSyncTaskSuccess();
            break;
          case "error":
            setTimestampMessage(update.message);
            setErrors((prev) => [...prev, `Sync content failed: ${update.message}`]);
            break;
        }
      }

      function metadataProgressObserver(update: SyncMetadataUpdate) {
        switch (update.type) {
          case "progress":
            if (errors.length) return; // don't override existing errors
            setTimestampMessage(update.message);
            break;
          case "success":
            setTimestampMessage(update.message);
            onInitialSyncTaskSuccess();
            break;
          case "error":
            setTimestampMessage(update.message);
            setErrors((prev) => [...prev, `Sync metadata failed: ${update.message}`]);
            break;
        }
      }
      workerClient.subscribe<SyncContentUpdate>("sync-progress", contentProgressObserver);
      workerClient.subscribe<SyncMetadataUpdate>("sync-metadata-progress", metadataProgressObserver);

      // full sync
      await Promise.all([
        workerClient.post<SyncContentRequest, SyncContentResponse>("sync-content", { config, rebuildIndex: true }),
        workerClient.post<SyncMetadataRequest, SyncMetadataResponse>("sync-metadata", { config }),
      ]);

      workerClient.unsubscribe("sync-progress", contentProgressObserver);
      workerClient.unsubscribe("sync-metadata-progress", metadataProgressObserver);
    } else {
      // incremental sync
      function contentProgressObserver(update: SyncContentUpdate) {
        switch (update.type) {
          case "success":
            setTimestampMessage(update.message);
            break;
          case "error":
            setTimestampMessage(update.message);
            break;
        }
      }
      workerClient.subscribe<SyncContentUpdate>("sync-progress", contentProgressObserver);

      await workerClient.post<SyncContentRequest, SyncContentResponse>("sync-content", { config });

      workerClient.unsubscribe("sync-progress", contentProgressObserver);
    }
  }, [config, isInitialSyncDone, errors]);

  // polling sync
  useRecursiveTimer(requestSync, isOffline || !config ? null : POLLING_INTERVAL * 1000);
  useEffect(() => {
    if (!config) return;

    requestSync();
  }, [config]);

  // display items
  useEffect(() => {
    if (debouncedQuery.trim().length && searchItems) {
      setSearchResult(searchItems);
    } else if (recentItems) {
      setSearchResult(recentItems);
    }
  }, [recentItems, searchItems, debouncedQuery]);

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
        {searchResult === undefined && <li className="work-item">Waiting for data...</li>}
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
              <span className="work-item__path work-item__matchable" title={`Iteration: ${item.iterationPath}`} data-matched={item.isShortIterationPathMatched}>
                {item.shortIterationPath}
              </span>
            </div>
          </li>
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
