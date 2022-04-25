import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { WorkerClient } from "../ipc/client";
import { IndexChangedUpdate } from "../service/emitters/index-manager";
import { RecentItemsChangedUpdate } from "../service/emitters/recent-content-manager";
import { RecentItemsResponse } from "../service/handlers/handle-get-recent";
import { SearchRequest, SearchResponse } from "../service/handlers/handle-search";
import { SyncRequest, SyncResponse } from "../service/handlers/handle-sync";
import { DisplayItem } from "../service/utils/get-display-item";
import { getSummaryMessage } from "../service/utils/get-summary-message";
import { useConfigGuard } from "./components/hooks/use-config-guard";
import { useIsOffline } from "./components/hooks/use-is-offline";
import { useRecursiveTimer } from "./components/hooks/use-recursive-timer";
import { TypeIcon } from "./components/type-icon/type-icon";
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

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "/" && e.target !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setActiveQuery(e.target.value);
    localStorage.setItem("last-query", e.target.value);
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

  // polling sync
  // TODO start interval after prev request is finished
  useRecursiveTimer(requestSync, isOffline ? null : pollingInterval * 1000);
  useEffect(() => {
    requestSync(true);
  }, [config]); // start now and rebuild index on this initial sync

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

  const handleIdClick = useCallback<React.MouseEventHandler>((e: React.MouseEvent<HTMLSpanElement>) => selectElementContent(e.target as HTMLSpanElement), []);

  const handleLinkClick = useCallback<React.MouseEventHandler>(async (e: React.MouseEvent<HTMLSpanElement>) => {
    e.preventDefault();

    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const url = (e.target as HTMLAnchorElement).href;

    if (isCtrl) {
      chrome.tabs.create({ url, active: isShift });
    } else {
      chrome.tabs.update({ url });
    }
  }, []);

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
            placeholder="Search by title or metadata... (press / to focus)"
          />
        </div>
      </div>

      <ul className="work-item-list">
        {searchResult === undefined && <li className="work-item">Initializing...</li>}
        {searchResult?.length === 0 && <li className="work-item">No result</li>}
        {searchResult?.map((item) => (
          <li className="work-item" key={item.id}>
            <span className="work-item__state-bar" title={item.state}></span>
            <TypeIcon type={item.workItemType} />
            <div>
              <span
                className="work-item__id work-item__matchable"
                data-matched={item.isIdMatched}
                tabIndex={0}
                onFocus={handleTextFocus}
                onBlur={handleTextBlur}
                onClick={handleIdClick}
              >
                {item.id}
              </span>{" "}
              <a
                className="work-item__link"
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
                    <span className="work-item__tag work-item__matchable" data-matched={item.isTagMatched?.[i]}>
                      {tag}
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
