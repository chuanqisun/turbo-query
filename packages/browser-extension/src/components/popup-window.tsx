import { useLiveQuery } from "dexie-react-hooks";
import FlexSearch from "flexsearch";
import React, { useCallback, useEffect, useState } from "react";
import { db, DbWorkItem } from "./data/db";
import { BugIcon } from "./icons/bug-icon";
import { CheckboxIcon } from "./icons/checkbox-icon";
import { CrownIcon } from "./icons/crown-icon";
import { TrophyIcon } from "./icons/trophy-icon";
import "./popup-window.css";
import { getPatHeader } from "./utils/auth";
import { getConfig } from "./utils/config";
import { env } from "./utils/env";

const pollingInterval = 10;

const index = new FlexSearch.Document<IndexedItem>({
  preset: "match",
  worker: true,
  tokenize: "full",
  document: {
    id: "id",
    index: ["title"],
  },
});

interface IndexedItem {
  id: number;
  title: string;
}

export const PopupWindow = () => {
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<DbWorkItem[]>([]);

  const [activeTypes, setActiveTypes] = useState<string[]>(["deliverable", "bug", "scenario"]);

  const recentItems = useLiveQuery(() => db.workItems.orderBy("changedDate").reverse().limit(100).toArray());
  const allItemsKeys = useLiveQuery(() => db.workItems.toCollection().primaryKeys());

  useEffect(() => {
    if (!allItemsKeys) return;

    indexAllItems();
  }, [allItemsKeys]);

  useEffect(() => {
    const interval = pollingSync();
    return () => window.clearInterval(interval);
  }, []);

  // TODO index update might occur after query execution. Need to make this dependency explicit
  useEffect(() => {
    if (!query.trim().length) {
      setSearchResult([]);
    }

    index.searchAsync(query).then(async (matches) => {
      const titleMatchIds = matches.find((match) => match.field === "title")?.result ?? [];
      const matchedItems = await db.workItems.bulkGet(titleMatchIds);
      setSearchResult(matchedItems as DbWorkItem[]);
    });
  }, [allItemsKeys, query]);

  const typeToIcon = useCallback((type: string) => {
    switch (type) {
      case "Deliverable":
        return <TrophyIcon width={16} fill="#005eff" />;
      case "Task":
        return <CheckboxIcon width={16} fill="#f2cb1d" />;
      case "Scenario":
        return <CrownIcon width={16} fill="#773b93" />;
      case "Bug":
        return <BugIcon width={16} fill="#cc293d" />;
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

  return (
    <div>
      <div>
        <button onClick={resetDb}>Reset DB</button>
        <button onClick={sync}>Sync</button>
        <button onClick={openConfig}>Config</button>
      </div>
      <input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} />
      <fieldset>
        <legend>Types</legend>
        <label>
          <input type="checkbox" name="type" value="scenario" onChange={onToggleActiveCheckbox} checked={activeTypes.includes("scenario")} />
          <CrownIcon width={16} fill="#773b93" />
        </label>
        <label>
          <input type="checkbox" name="type" value="deliverable" onChange={onToggleActiveCheckbox} checked={activeTypes.includes("deliverable")} />
          <TrophyIcon width={16} fill="#005eff" />
        </label>
        <label>
          <input type="checkbox" name="type" value="bug" onChange={onToggleActiveCheckbox} checked={activeTypes.includes("bug")} />
          <BugIcon width={16} fill="#cc293d" />
        </label>
        <label>
          <input type="checkbox" name="type" value="task" onChange={onToggleActiveCheckbox} checked={activeTypes.includes("task")} />
          <CheckboxIcon width={16} fill="#f2cb1d" />
        </label>
      </fieldset>
      {query.length > 0 && (
        <section>
          <h2>Search</h2>
          <ul>
            {searchResult.map((item) => (
              <li key={item.id}>
                {typeToIcon(item.workItemType)}
                {item.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Recent</h2>
        <ul>
          {recentItems?.map((item) => (
            <li key={item.id}>
              {typeToIcon(item.workItemType)}
              {item.title}
            </li>
          ))}
        </ul>
      </section>
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
    const pages = await Promise.all(idPages.map(getWorkItems.bind(null, ["System.Title", "System.WorkItemType", "System.ChangedDate"])));
    const allItems = pages.flat();
    await initializeDb(allItems);
    console.log(`[sync] populated with all dataset`);
  } else {
    for (const [index, ids] of idPages.entries()) {
      const remoteItems = await getWorkItems(["System.Title", "System.WorkItemType", "System.ChangedDate"], ids);

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
      title: item.title,
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

interface BasicFields {
  "System.Title": string;
  "System.WorkItemType": string;
  "System.ChangedDate": string;
}
