import { useLiveQuery } from "dexie-react-hooks";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { WorkerClient } from "../ipc/client";
import { SearchRequest, SearchResponse } from "../service/handlers/handle-search";
import { isDefined } from "../service/utils/guard";
import { sortByState } from "../service/utils/sort";
import { db, DbWorkItem } from "./components/data/db";
import { useConfig } from "./components/hooks/use-config";
import { useInterval } from "./components/hooks/use-interval";
import { useIsOffline } from "./components/hooks/use-is-offline";
import { useSearchIndex } from "./components/hooks/use-search-index";
import { TypeIcon } from "./components/type-icon/type-icon";
import { selectElementContent } from "./components/utils/dom";
import { getShortIteration } from "./components/utils/iteration";
import { sync } from "./components/utils/sync";
import { tokenize } from "./components/utils/token";

const pollingInterval = 10;
const worker = new Worker("./modules/service/worker.js");
const workerClient = new WorkerClient(worker);

export const PopupWindow: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<DbWorkItem[]>([]);
  const isOffline = useIsOffline();
  const [progressMessage, setProgressMessage] = useState<null | string>(null);

  const initialQuery = useRef(localStorage.getItem("last-query"));

  const setTimestampMessage = useCallback((message: string) => setProgressMessage(`${new Date().toLocaleTimeString()} ${message}`), []);

  const config = useConfig(() => {
    chrome.runtime.openOptionsPage();
    setTimestampMessage("Please complete the setup first");
  });

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

  useEffect(() => {
    if (initialQuery.current) {
      setQuery(initialQuery.current);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("last-query", query);
  }, [query]);

  useEffect(() => {
    setTimestampMessage(isOffline ? "Network offline" : "Network online");
  }, [isOffline]);

  const recentItems = useLiveQuery(() => db.workItems.orderBy("changedDate").reverse().limit(100).toArray(), []);
  const allItemsKeys = useLiveQuery(() => db.workItems.toCollection().primaryKeys());

  const { rev: indexRev, index } = useSearchIndex({
    skip: !allItemsKeys,
    deps: [allItemsKeys],
  });

  // start-up sync
  useEffect(() => {
    sync({
      onIdProgress: setTimestampMessage,
      onItemInitProgress: setTimestampMessage,
      onSyncSuccess: setTimestampMessage,
      onError: setTimestampMessage,
    }); // initial sync should not be delayed
  }, []);

  // polling sync
  useInterval(
    sync.bind(null, {
      onSyncSuccess: setTimestampMessage,
      onError: setTimestampMessage,
    }),
    isOffline ? null : pollingInterval * 1000
  );

  // recent
  useEffect(() => {
    if (!recentItems) return;
    if (query.trim().length) return;

    setSearchResult(recentItems);
  }, [recentItems, query]);

  // search
  useEffect(() => {
    if (!query.trim().length) return;
    if (!index) return;

    workerClient.post<SearchRequest, SearchResponse>("search", { query }).then((response) => {
      console.log(response.items);
    });

    index.searchAsync(query.trim(), { index: "fuzzyTokens" }).then((matches) => {
      const titleMatchIds = matches.map((match) => match.result).flat() ?? [];
      db.workItems.bulkGet(titleMatchIds).then((items) => setSearchResult(items.filter(isDefined).sort(sortByState)));
    });
  }, [indexRev, index, query]);

  const queryTokens = useMemo(() => tokenize(query), [query]);
  const isTokenMatch = useCallback(
    (maybeToken: string) =>
      queryTokens.some((token) =>
        maybeToken
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase()
          .includes(token)
      ),
    [queryTokens]
  );

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

  return (
    <div className="stack-layout">
      <div className="query-bar">
        <div className="query-bar__input-group">
          <button onClick={openConfig}>⚙️</button>
          <input
            className="query-bar__input"
            ref={inputRef}
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or metadata... (press / to focus)"
          />
        </div>
      </div>

      <ul className="work-item-list">
        {searchResult.map((item) => (
          <li className="work-item" key={item.id}>
            <span className="work-item__state-bar" title={item.state}></span>
            <TypeIcon type={item.workItemType} />
            <div>
              <span
                className="work-item__id work-item__matchable"
                data-matched={isTokenMatch(item.id.toString())}
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
                    <span className="work-item__tag work-item__matchable" data-matched={isTokenMatch(tag)}>
                      {tag}
                    </span>{" "}
                  </React.Fragment>
                ))}
              <span className="work-item__state work-item__matchable" data-matched={isTokenMatch(item.state)}>
                {item.state}
              </span>
              {" · "}
              <span className="work-item__type work-item__matchable" data-matched={isTokenMatch(item.workItemType)}>
                {item.workItemType}
              </span>
              {" · "}
              <span className="work-item__assigned-to work-item__matchable" data-matched={isTokenMatch(item.assignedTo.displayName)}>
                {item.assignedTo.displayName}
              </span>
              {" · "}
              <span className="work-item__path work-item__matchable" data-matched={isTokenMatch(item.iterationPath)}>
                {getShortIteration(item.iterationPath)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <output className="status-bar">{progressMessage}</output>
    </div>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <PopupWindow />
  </React.StrictMode>,
  document.getElementById("root")
);
