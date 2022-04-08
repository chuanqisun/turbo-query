import { useLiveQuery } from "dexie-react-hooks";
import FlexSearch from "flexsearch";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db, DbWorkItem } from "./data/db";
import "./popup-window.css";
import { TypeIcon } from "./type-icon/type-icon";
import { Config, getConfig } from "./utils/config";
import { selectElementContent } from "./utils/dom";
import { getAllDeletedWorkItemIds, getAllWorkItemIds, getWorkItems, WorkItem } from "./utils/proxy";

const pollingInterval = 10;

const index = new FlexSearch.Document<IndexedItem>({
  preset: "match",
  worker: true,
  charset: "latin:advanced",
  tokenize: "full",
  document: {
    id: "id",
    index: ["fuzzyTokens"],
  },
});

interface IndexedItem {
  id: number;
  fuzzyTokens: string;
}

export const PopupWindow = () => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchResult, setSearchResult] = useState<DbWorkItem[]>([]);
  const [config, setConfig] = useState<Config>();

  const [progressMessage, setProgressMessage] = useState<null | string>(null);

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
    const lastQuery = localStorage.getItem("last-query");
    if (lastQuery) {
      setQuery(lastQuery);
    }
  }, []);

  useEffect(() => {
    const onOffline = () => setProgressMessage("Network offline");
    const onOnline = () => setProgressMessage("Network online");
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  });

  useEffect(() => {
    localStorage.setItem("last-query", query);
  }, [query]);

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  const recentItems = useLiveQuery(() => db.workItems.orderBy("changedDate").reverse().limit(100).toArray(), []);
  const allItemsKeys = useLiveQuery(() => db.workItems.toCollection().primaryKeys());

  const [indexRev, setIndexRev] = useState(0);

  useEffect(() => {
    if (!allItemsKeys) return;
    const startTime = performance.now();
    indexAllItems().then(() => {
      const duration = performance.now() - startTime;
      console.log(`index updated ${duration.toFixed(2)}ms`);
      setTimeout(() => {
        setIndexRev((prev) => prev + 1);
      }, 100); // potentially flexsearch bug: additional delay needed before indexing is done
    });
  }, [allItemsKeys]);

  useEffect(() => {
    sync({
      onIdProgress: setProgressMessage,
      onItemInitProgress: setProgressMessage,
      onSyncSuccess: setProgressMessage,
    }); // initial sync should not be delayed
    const interval = setInterval(
      sync.bind(null, {
        onSyncSuccess: setProgressMessage,
      }),
      pollingInterval * 1000
    );
    return () => window.clearInterval(interval);
  }, []);

  // recent
  useEffect(() => {
    if (!recentItems) return;
    if (query.trim().length) return;

    setSearchResult(recentItems);
  }, [recentItems, query]);

  // search
  const parsedQuery = useMemo(() => parseQuery(query), [query]);

  useEffect(() => {
    if (!query.trim().length) return;

    index.searchAsync(query.trim(), { index: "fuzzyTokens" }).then((matches) => {
      const titleMatchIds = matches.map((match) => match.result).flat() ?? [];
      db.workItems.bulkGet(titleMatchIds).then((items) => setSearchResult(items as DbWorkItem[]));
    });
  }, [indexRev, query, parsedQuery]);

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
              <span className="work-item__type">{item.workItemType}</span>{" "}
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
              <span className="work-item__assigned-to">{item.assignedTo.displayName}</span>{" "}
              <span className="work-item__path">{getShortIteration(item.iterationPath)}</span>
            </div>
          </li>
        ))}
      </ul>

      {<output className="status-bar">{progressMessage}</output>}
    </div>
  );
};

export interface SyncConfig {
  onIdProgress?: (message: string) => any;
  onItemInitProgress?: (message: string) => any;
  onSyncSuccess?: (message: string) => any;
}
async function sync(config?: SyncConfig) {
  config?.onIdProgress?.("Fetching item ids");
  const allIds = await getAllWorkItemIds();
  config?.onIdProgress?.(`Fetching item ids... ${allIds.length} found`);
  const allDeletedIdsAsync = getAllDeletedWorkItemIds();
  const idPages = getIdPages(allIds);
  console.log(`[sync] ${allIds.length} items, ${idPages.length} pages`);

  // Scenarios where re-population is required:
  // - Empty store <- handled here
  // - Data corrupted
  // - DB migrated
  const count = await db.workItems.count();

  if (!count) {
    let progress = 0;
    const pages = await Promise.all(
      idPages
        .map(
          getWorkItems.bind(null, ["System.Title", "System.WorkItemType", "System.ChangedDate", "System.AssignedTo", "System.State", "System.IterationPath"])
        )
        .map(async (page, i) => {
          await page;

          progress += idPages[i].length;

          config?.onIdProgress?.(`Fetching item content: ${((progress / allIds.length) * 100).toFixed(2)}%`);

          return page;
        })
    );
    const allItems = pages.flat();
    await initializeDb(allItems);
    console.log(`[sync] populated with all dataset`);
  } else {
    for (const [index, ids] of idPages.entries()) {
      const remoteItems = await getWorkItems(
        ["System.Title", "System.WorkItemType", "System.ChangedDate", "System.AssignedTo", "System.State", "System.IterationPath"],
        ids
      );

      const localItems = await db.workItems.bulkGet(remoteItems.map((item) => item.id));

      const syncPlan = getPageDiff(remoteItems, localItems);
      console.log(`[sync] page ${index}: +${syncPlan.addedIds.length} !${syncPlan.dirtyIds.length} *${syncPlan.cleanIds.length}`);
      if (syncPlan.corruptIds.length) throw new Error("Data corrupted");

      const addedItems = remoteItems.filter((item) => syncPlan.addedIds.includes(item.id));
      const dirtItems = remoteItems.filter((item) => syncPlan.dirtyIds.includes(item.id));

      await putDbItems(addedItems);
      await putDbItems(dirtItems);

      // local items more recent than MRCI is either dirty or deleted
      if (syncPlan.cleanIds.length) {
        break;
      }
    }

    const allDeletedIds = await allDeletedIdsAsync;
    const deletedIds = await deleteDbItems(allDeletedIds);
    console.log(`[sync] deleted ${deletedIds.length}`);
  }

  config?.onSyncSuccess?.(`Successful synced ${new Date().toLocaleTimeString()}`);
}

function parseQuery(raw: string) {
  const tagsPattern = /\|((.|[^|])*)\|/g;

  const tagsString = raw.matchAll(tagsPattern);
  const allTags = [...tagsString]
    .flatMap((match) => match[1].split("|"))
    .map((tag) => tag.trim().toLocaleLowerCase())
    .filter((tag) => tag.length);
  const tags = [...new Set(allTags)];
  const text = raw.replaceAll(tagsPattern, "").trim();

  return {
    text,
    tags,
  };
}

// delete is not handled yet. Require re-population
interface PageDiffSummary {
  addedIds: number[];
  dirtyIds: number[];
  cleanIds: number[];
  corruptIds: number[];
}

function getPageDiff(remoteItems: WorkItem[], localItems: (DbWorkItem | undefined)[]): PageDiffSummary {
  const summary: PageDiffSummary = {
    addedIds: [],
    dirtyIds: [],
    cleanIds: [],
    corruptIds: [],
  };

  remoteItems.map((remote, index) => {
    const local = localItems[index];
    if (!local) {
      summary.addedIds.push(remote.id);
    } else if (remote.rev > local.rev) {
      summary.dirtyIds.push(remote.id);
    } else if (remote.rev === local.rev) {
      summary.cleanIds.push(remote.id);
    } else {
      summary.corruptIds.push(remote.id);
    }
  });

  return summary;
}

async function indexAllItems() {
  const indexTasks: Promise<any>[] = [];
  db.workItems.each((item) => {
    const fuzzyTokens = `${item.state} ${item.workItemType} ${item.id} ${item.assignedTo.displayName} ${getShortIteration(item.iterationPath)} ${item.title}`;

    indexTasks.push(
      index.addAsync(item.id, {
        id: item.id,
        fuzzyTokens,
      })
    );
  });

  await Promise.all(indexTasks);
}

async function initializeDb(allItems: WorkItem[]) {
  await db.workItems.clear();
  await putDbItems(allItems);
}

async function putDbItems(items: WorkItem[]) {
  await db.workItems.bulkPut(
    items.map((item) => ({
      id: item.id,
      rev: item.rev,
      title: item.fields["System.Title"],
      changedDate: new Date(item.fields["System.ChangedDate"]),
      workItemType: item.fields["System.WorkItemType"],
      assignedTo: {
        displayName: item.fields["System.AssignedTo"].displayName,
      },
      state: item.fields["System.State"],
      iterationPath: item.fields["System.IterationPath"],
    }))
  );
}

async function deleteDbItems(ids: number[]): Promise<number[]> {
  const foundItems = await db.workItems.bulkGet(ids);
  const foundIds = foundItems.filter((item) => item).map((item) => item!.id);
  await db.workItems.bulkDelete(foundIds);
  return foundIds;
}

function getShortIteration(iterationPath: string): string {
  const i = iterationPath.lastIndexOf("\\");
  const shortPath = iterationPath.slice(i + 1);
  return shortPath;
}

function getIdPages(allIds: number[]): number[][] {
  const pages: number[][] = [];
  for (var i = 0; i < allIds.length; i += 200) pages.push(allIds.slice(i, i + 200));
  return pages;
}
