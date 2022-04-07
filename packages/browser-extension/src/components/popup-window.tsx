import { useLiveQuery } from "dexie-react-hooks";
import FlexSearch from "flexsearch";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { db, DbWorkItem } from "./data/db";
import { BugIcon } from "./icons/bug-icon";
import { CheckboxIcon } from "./icons/checkbox-icon";
import { CrownIcon } from "./icons/crown-icon";
import { TrophyIcon } from "./icons/trophy-icon";
import "./popup-window.css";
import { getPatHeader } from "./utils/auth";
import { Config, getConfig } from "./utils/config";
import { selectElementContent } from "./utils/dom";
import { env } from "./utils/env";

const pollingInterval = 10;

const index = new FlexSearch.Document<IndexedItem>({
  preset: "match",
  worker: true,
  document: {
    id: "id",
    index: [{ field: "comboTitle", tokenize: "full", charset: "latin:advanced" }],
  },
});

interface IndexedItem {
  id: number;
  comboTitle: string; // <id> <title> <assignedTo>
}

export const PopupWindow = () => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchResult, setSearchResult] = useState<DbWorkItem[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>(["Deliverable", "Bug", "Scenario"]);
  const [config, setConfig] = useState<Config>();

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
    const lastFiltersString = localStorage.getItem("last-filters");
    if (lastFiltersString) {
      try {
        const { activeTypes } = JSON.parse(lastFiltersString);
        setActiveTypes(activeTypes);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("last-filters", JSON.stringify({ activeTypes }));
  }, [activeTypes]);

  useEffect(() => {
    const lastQuery = localStorage.getItem("last-query");
    if (lastQuery) {
      setQuery(lastQuery);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("last-query", query);
  }, [query]);

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  const recentFilteredItems = useLiveQuery(
    () =>
      db.workItems
        .orderBy("changedDate")
        .reverse()
        .filter((item) => activeTypes.includes(item.workItemType))
        .limit(100)
        .toArray(),
    [activeTypes]
  );

  const allFilteredItemIds = useLiveQuery(() => db.workItems.filter((item) => activeTypes.includes(item.workItemType)).primaryKeys(), [activeTypes]);

  const allItemsKeys = useLiveQuery(() => db.workItems.toCollection().primaryKeys());

  const [indexRev, setIndexRev] = useState(0);

  useEffect(() => {
    if (!allItemsKeys) return;
    indexAllItems();

    setIndexRev((prev) => prev + 1);
  }, [allItemsKeys]);

  useEffect(() => {
    const interval = pollingSync();
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!recentFilteredItems) return;

    if (!query.trim().length) {
      setSearchResult(recentFilteredItems);
    } else {
      index.searchAsync(query).then(async (matches) => {
        const titleMatchIds = matches.find((match) => match.field === "comboTitle")?.result ?? [];
        const filteredMatchIds = titleMatchIds.filter((id) => allFilteredItemIds?.includes(id)); // Search can wait for init
        db.workItems.bulkGet(filteredMatchIds).then((items) => setSearchResult(items as DbWorkItem[]));
      });
    }
  }, [recentFilteredItems, allFilteredItemIds, indexRev, query]);

  const typeToIcon = useCallback((type: string) => {
    switch (type) {
      case "Deliverable":
        return <TrophyIcon className="work-item__icon" width={16} fill="#005eff" />;
      case "Task":
        return <CheckboxIcon className="work-item__icon" width={16} fill="#f2cb1d" />;
      case "Scenario":
        return <CrownIcon className="work-item__icon" width={16} fill="#773b93" />;
      case "Bug":
        return <BugIcon className="work-item__icon" width={16} fill="#cc293d" />;
    }
  }, []);

  const resetDb = useCallback(() => {
    db.delete().then(() => location.reload());
  }, []);

  const openConfig = useCallback(() => {
    chrome.runtime.openOptionsPage();
  }, []);

  const onToggleActiveCheckbox = useCallback<React.ChangeEventHandler<HTMLInputElement>>((e) => {
    const value = e.target.getAttribute("value")!;

    setActiveTypes((previous) => {
      if (e.target.checked) {
        return [...previous, value];
      } else {
        return previous.filter((item) => item !== value);
      }
    });
  }, []);

  const handleClickId = useCallback<React.MouseEventHandler>((e: React.MouseEvent<HTMLSpanElement>) => selectElementContent(e.target as HTMLSpanElement), []);
  const handleFocusId = useCallback<React.FocusEventHandler>((e: React.FocusEvent<HTMLSpanElement>) => selectElementContent(e.target as HTMLSpanElement), []);
  const handleBlurId = useCallback<React.FocusEventHandler>((_e: React.FocusEvent<HTMLSpanElement>) => window.getSelection()?.removeAllRanges(), []);

  return (
    <div>
      <div className="query-bar">
        <div className="query-bar__input-group">
          <div>
            <button onClick={openConfig}>Config</button>
            <button onClick={resetDb}>Reset DB</button>
            <button onClick={sync}>Sync</button>
          </div>

          <div className="type-filter-list">
            <label>
              <input type="checkbox" name="type" value="Scenario" onChange={onToggleActiveCheckbox} checked={activeTypes.includes("Scenario")} />
              <CrownIcon width={16} fill="#773b93" />
            </label>
            <label>
              <input type="checkbox" name="type" value="Deliverable" onChange={onToggleActiveCheckbox} checked={activeTypes.includes("Deliverable")} />
              <TrophyIcon width={16} fill="#005eff" />
            </label>
            <label>
              <input type="checkbox" name="type" value="Bug" onChange={onToggleActiveCheckbox} checked={activeTypes.includes("Bug")} />
              <BugIcon width={16} fill="#cc293d" />
            </label>
            <label>
              <input type="checkbox" name="type" value="Task" onChange={onToggleActiveCheckbox} checked={activeTypes.includes("Task")} />
              <CheckboxIcon width={16} fill="#f2cb1d" />
            </label>
          </div>
        </div>

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
      <ul className="work-item-list">
        {searchResult.map((item) => (
          <li className="work-item" key={item.id}>
            {typeToIcon(item.workItemType)}
            <div>
              <span className="work-item__type">Deliverable</span>{" "}
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
              <span className="work-item__assigned-to">{item.assignedTo.displayName}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

async function sync() {
  const allIds = await getAllWorkItemIds();
  const allDeletedIdsAsync = getAllDeletedWorkItemIds();
  const idPages = getIdPages(allIds);
  console.log(`[sync] ${allIds.length} items, ${idPages.length} pages`);

  // Scenarios where re-population is required:
  // - Empty store <- handled here
  // - Data corrupted
  // - DB migrated
  const count = await db.workItems.count();
  if (!count) {
    const pages = await Promise.all(idPages.map(getWorkItems.bind(null, ["System.Title", "System.WorkItemType", "System.ChangedDate", "System.AssignedTo"])));
    const allItems = pages.flat();
    await initializeDb(allItems);
    console.log(`[sync] populated with all dataset`);
  } else {
    for (const [index, ids] of idPages.entries()) {
      const remoteItems = await getWorkItems(["System.Title", "System.WorkItemType", "System.ChangedDate", "System.AssignedTo"], ids);

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
}

function pollingSync() {
  return setInterval(sync, pollingInterval * 1000);
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
  const start = performance.now();

  db.workItems.each((item) =>
    index.add({
      id: item.id,
      comboTitle: `${item.id} ${item.title} ${item.assignedTo.displayName}`,
    })
  );

  const duration = (performance.now() - start).toFixed(0);
  console.log(`[index] done ${duration} ms`);
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
    }))
  );
}

async function deleteDbItems(ids: number[]): Promise<number[]> {
  const foundItems = await db.workItems.bulkGet(ids);
  const foundIds = foundItems.filter((item) => item).map((item) => item!.id);
  await db.workItems.bulkDelete(foundIds);
  return foundIds;
}

async function getAllDeletedWorkItemIds(): Promise<number[]> {
  const config = await getConfig();
  const patHeader = getPatHeader(config);

  return fetch(`https://dev.azure.com/${config.org}/${config.project}/${config.team}/_apis/wit/wiql/${env.rootDeletedQueryId}?api-version=6.0`, {
    headers: { ...patHeader },
  })
    .then((result) => result.json())
    .then((result) => {
      return (result.workItems as { id: number }[]).map((item) => item.id);
    });
}

async function getAllWorkItemIds(): Promise<number[]> {
  const config = await getConfig();
  const patHeader = getPatHeader(config);

  return fetch(`https://dev.azure.com/${config.org}/${config.project}/${config.team}/_apis/wit/wiql/${env.rootQueryId}?api-version=6.0`, {
    headers: { ...patHeader },
  })
    .then((result) => result.json())
    .then((result) => {
      return (result.workItems as { id: number }[]).map((item) => item.id);
    });
}

async function getWorkItems(fields: string[], ids: number[]): Promise<WorkItem[]> {
  const config = await getConfig();
  const patHeader = getPatHeader(config);

  return fetch(`https://dev.azure.com/${config.org}/${config.project}/_apis/wit/workitemsbatch?api-version=6.0`, {
    method: "post",
    headers: { ...patHeader, "Content-Type": "application/json" },
    body: JSON.stringify({
      ids,
      fields,
    }),
  })
    .then((result) => result.json())
    .then((result: BatchSummary) => {
      return result.value;
    });
}

function getIdPages(allIds: number[]): number[][] {
  const pages: number[][] = [];
  for (var i = 0; i < allIds.length; i += 200) pages.push(allIds.slice(i, i + 200));
  return pages;
}

interface BatchSummary {
  count: number;
  value: WorkItem[];
}

interface WorkItem {
  id: number;
  rev: number;
  fields: BasicFields;
  url: string;
}

interface AdoUser {
  displayName: string;
}

interface BasicFields {
  "System.Title": string;
  "System.WorkItemType": string;
  "System.ChangedDate": string;
  "System.AssignedTo": AdoUser;
}
