import { useLiveQuery } from "dexie-react-hooks";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { db, DbWorkItem } from "./data/db";
import { useConfig } from "./hooks/use-config";
import { useInterval } from "./hooks/use-interval";
import { useIsOffline } from "./hooks/use-is-offline";
import "./popup-window.css";
import { TypeIcon } from "./type-icon/type-icon";
import { selectElementContent } from "./utils/dom";
import { index, indexAllItems } from "./utils/fts";
import { getShortIteration } from "./utils/iteration";
import { sync } from "./utils/sync";

const pollingInterval = 10;

export const PopupWindow = () => {
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

  // useEffect(() => {
  //   const startTime = performance.now();
  //   importIndex().then(() => {
  //     const duration = performance.now() - startTime;
  //     setTimestampMessage(`Imported search index (${duration.toFixed(2)}ms)`);
  //     setIndexRev((prev) => prev + 1);
  //   });
  // }, []);

  useEffect(() => {
    localStorage.setItem("last-query", query);
  }, [query]);

  useEffect(() => {
    setTimestampMessage(isOffline ? "Network offline" : "Network online");
  }, [isOffline]);

  const recentItems = useLiveQuery(() => db.workItems.orderBy("changedDate").reverse().limit(20).toArray(), []);
  const allItemsKeys = useLiveQuery(() => db.workItems.toCollection().primaryKeys());

  const [indexRev, setIndexRev] = useState(0);

  // reindex
  useEffect(() => {
    const startTime = performance.now();
    indexAllItems().then(async () => {
      const duration = performance.now() - startTime;
      setTimestampMessage(`Search index ready (${duration.toFixed(2)}ms)`);
      console.log(`index duration: ${duration.toFixed(2)}ms)`);
      setIndexRev((prev) => prev + 1);
      db.indexItems.clear();
      index.export((key, value) => {
        db.indexItems.put({
          key: key as string,
          value: value as any as string | undefined,
        });
      });
    });
  }, [allItemsKeys]);

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

    console.log(indexRev);
    index.searchAsync(query.trim(), { index: "fuzzyTokens" }).then((matches) => {
      const titleMatchIds = matches.map((match) => match.result).flat() ?? [];
      db.workItems.bulkGet(titleMatchIds).then((items) => setSearchResult(items as DbWorkItem[]));
    });
  }, [indexRev, query]);

  const openConfig = useCallback(() => {
    chrome.runtime.openOptionsPage();
  }, []);

  const handleClickId = useCallback<React.MouseEventHandler>((e: React.MouseEvent<HTMLSpanElement>) => selectElementContent(e.target as HTMLSpanElement), []);
  const handleFocusId = useCallback<React.FocusEventHandler>((e: React.FocusEvent<HTMLSpanElement>) => selectElementContent(e.target as HTMLSpanElement), []);
  const handleBlurId = useCallback<React.FocusEventHandler>((_e: React.FocusEvent<HTMLSpanElement>) => window.getSelection()?.removeAllRanges(), []);

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
            placeholder='Search ("/")'
          />
        </div>
      </div>

      <ul className="work-item-list">
        {searchResult.map((item) => (
          <li className="work-item" key={item.id}>
            <span className="work-item__state" title={item.state}></span>
            <TypeIcon type={item.workItemType} />
            <div>
              <span className="work-item__id" tabIndex={0} onFocus={handleFocusId} onBlur={handleBlurId} onClick={handleClickId}>
                {item.id}
              </span>{" "}
              <a
                className="work-item__link"
                target="_blank"
                onFocus={handleFocusId}
                onBlur={handleBlurId}
                href={`https://dev.azure.com/${config!.org}/${config!.project}/_workitems/edit/${item.id}`}
              >
                {item.title}
              </a>{" "}
              <span className="work-item__type">{item.workItemType}</span> <span className="work-item__assigned-to">{item.assignedTo.displayName}</span>{" "}
              <span className="work-item__path">{getShortIteration(item.iterationPath)}</span>
            </div>
          </li>
        ))}
      </ul>

      <output className="status-bar">{progressMessage}</output>
    </div>
  );
};
