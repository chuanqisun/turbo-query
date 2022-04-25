import { Db } from "../../db/db";
import { WorkerServer } from "../../ipc/server";
import { ALL_FIELDS, ApiProxy, Config } from "../ado/api-proxy";
import { deleteDbItems, initializeDb, putDbItems } from "../utils/db-writer";
import { getPageDiff } from "../utils/diff";
import { isSummaryDirty } from "../utils/get-is-summary-dirty";
import { getSummaryMessage } from "../utils/get-summary-message";
import { getPages } from "../utils/page";
import { HandlerContext } from "../worker";

export interface SyncRequest {
  config: Config;
  rebuildIndex?: boolean;
}

export interface SyncResponse {
  addedIds: number[];
  updatedIds: number[];
  deletedIds: number[];
}

export type SyncProgressUpdate = {
  type: "progress" | "success" | "error";
  message: string;
};

export async function handleSync({ server, indexManager, db }: HandlerContext, request: SyncRequest): Promise<SyncResponse> {
  const count = await db.workItems.count();
  const api = new ApiProxy(request.config);
  const syncStrategy = count ? incrementalSync.bind(null, db, server, api) : fullSync.bind(null, server, api);

  try {
    const summary = await syncStrategy();

    if (request.rebuildIndex) {
      performance.mark("index");
      server.emit<SyncProgressUpdate>("sync-progress", { type: "progress", message: "Building index..." });
      await indexManager.buildIndex();
      console.log(`[sync] Built index ${performance.measure("import duration", "index").duration.toFixed(2)}ms`);
    } else if (isSummaryDirty(summary)) {
      performance.mark("index");
      server.emit<SyncProgressUpdate>("sync-progress", { type: "progress", message: "Updating index..." });
      await indexManager.updateIndex(summary);
      console.log(`[sync] Updated index ${performance.measure("import duration", "index").duration.toFixed(2)}ms`);
    }

    server.emit<SyncProgressUpdate>("sync-progress", { type: "success", message: getSummaryMessage(summary) });

    return summary;
  } catch (e) {
    console.error(e);
    server.emit("sync-progress", { type: "error", message: (e as any)?.message ?? "Unknown error" });
    return {
      addedIds: [],
      updatedIds: [],
      deletedIds: [],
    };
  }
}

async function fullSync(server: WorkerServer, api: ApiProxy): Promise<SyncResponse> {
  server.emit<SyncProgressUpdate>("sync-progress", { type: "progress", message: "Fetching ids..." });
  const allIds = await api.getAllWorkItemIds();
  const idPages = getPages(allIds);
  server.emit<SyncProgressUpdate>("sync-progress", { type: "progress", message: `Fetching ids... found ${allIds.length} items, ${idPages.length} pages` });

  let progress = 0;
  const pages = await Promise.all(
    idPages.map(api.getWorkItems.bind(api, ALL_FIELDS)).map(async (page, i) => {
      await page;

      progress += idPages[i].length;

      server.emit<SyncProgressUpdate>("sync-progress", {
        type: "progress",
        message: `Fetching content: ${((progress / allIds.length) * 100).toFixed(2)}%`,
      });

      return page;
    })
  );
  const allItems = pages.flat();
  await initializeDb(allItems);

  const addedIds = allItems.map((item) => item.id);

  const summary: SyncResponse = {
    addedIds,
    updatedIds: [],
    deletedIds: [],
  };

  return summary;
}

async function incrementalSync(db: Db, server: WorkerServer, api: ApiProxy): Promise<SyncResponse> {
  server.emit<SyncProgressUpdate>("sync-progress", { type: "progress", message: `Peaking changes...` });
  const isChanged = await peekIsChanged(db, api);
  if (!isChanged) {
    return {
      addedIds: [],
      updatedIds: [],
      deletedIds: [],
    };
  }

  server.emit<SyncProgressUpdate>("sync-progress", { type: "progress", message: `Fetching ids...` });
  const allIds = await api.getAllWorkItemIds();
  const allDeletedIdsAsync = api.getAllDeletedWorkItemIds();
  const idPages = getPages(allIds);
  server.emit<SyncProgressUpdate>("sync-progress", { type: "progress", message: `Fetching item ids... found ${allIds.length} items, ${idPages.length} pages` });

  const addedIds: number[] = [];
  const updatedIds: number[] = [];

  for (const [index, ids] of idPages.entries()) {
    const remoteItems = await api.getWorkItems(ALL_FIELDS, ids);

    const localItems = await db.workItems.bulkGet(remoteItems.map((item) => item.id));

    const syncPlan = getPageDiff(remoteItems, localItems);
    console.log(`[sync] page ${index}: +${syncPlan.addedIds.length} !${syncPlan.dirtyIds.length} *${syncPlan.cleanIds.length}`);
    if (syncPlan.corruptIds.length) throw new Error("Data corrupted");

    const addedItems = remoteItems.filter((item) => syncPlan.addedIds.includes(item.id));
    const dirtyItems = remoteItems.filter((item) => syncPlan.dirtyIds.includes(item.id));

    await putDbItems(addedItems);
    await putDbItems(dirtyItems);

    addedIds.push(...addedItems.map((item) => item.id));
    updatedIds.push(...dirtyItems.map((item) => item.id));

    // local items more recent than MRCI is either dirty or deleted
    if (syncPlan.cleanIds.length) {
      break;
    }
  }

  const allDeletedIds = await allDeletedIdsAsync;
  const deletedIds = await deleteDbItems(allDeletedIds);

  console.log(`[sync] deleted ${deletedIds.length}`);

  const summary = {
    addedIds,
    updatedIds,
    deletedIds,
  };

  return summary;
}

async function peekIsChanged(db: Db, api: ApiProxy) {
  const hasUpsertionAsync = await api.getAllWorkItemIds({ top: 1 }).then(async (ids) => {
    if (!ids.length) return true; // Remote should not be empty. Treat as dirty to be safe
    const localItem = await db.workItems.get(ids[0]);
    if (!localItem) return true; // Local is missing. Treat as dirty.

    const remoteItems = await api.getWorkItems(ALL_FIELDS, ids);
    if (!remoteItems.length) return true; // Remote id should always exist. Treat as dirty to be safe

    return remoteItems[0].rev !== localItem.rev;
  });

  const hasDeletionAsync = await api.getAllDeletedWorkItemIds({ top: 1 }).then(async (ids) => {
    if (!ids.length) return false; // No deleted item. Treat as clean;
    const localItem = await db.workItems.get(ids[0]);
    if (localItem) return true; // Remote deleted but local exists. Definitely changed.

    return false;
  });

  const [hasUpsertion, hasDeletion] = await Promise.all([hasUpsertionAsync, hasDeletionAsync]);
  return hasUpsertion || hasDeletion;
}
