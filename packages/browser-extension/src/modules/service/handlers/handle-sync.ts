import { Db } from "../../db/db";
import { deleteDbItems, initializeDb, putDbItems } from "../../db/db-writer";
import { WorkerServer } from "../../ipc/server";
import { ALL_FIELDS, ApiProxy, Config } from "../ado/api-proxy";
import { getPageDiff } from "../utils/diff";
import { getPages } from "../utils/page";
import { HandlerContext } from "../worker";

export interface SyncRequest {
  config: Config;
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
    server.push<SyncProgressUpdate>("sync-progress", { type: "progress", message: "Indexing..." });
    await indexManager.buildIndex();
    server.push<SyncProgressUpdate>("sync-progress", { type: "success", message: getSummaryMessage(summary) });

    return summary;
  } catch (e) {
    console.error(e);
    server.push("sync-progress", { type: "error", message: (e as any)?.message ?? "Unknown error" });
    return {
      addedIds: [],
      updatedIds: [],
      deletedIds: [],
    };
  }
}

async function fullSync(server: WorkerServer, api: ApiProxy): Promise<SyncResponse> {
  server.push<SyncProgressUpdate>("sync-progress", { type: "progress", message: "Fetching ids..." });
  const allIds = await api.getAllWorkItemIds();
  const idPages = getPages(allIds);
  server.push<SyncProgressUpdate>("sync-progress", { type: "progress", message: `Fetching ids... found ${allIds.length} items, ${idPages.length} pages` });

  let progress = 0;
  const pages = await Promise.all(
    idPages.map(api.getWorkItems.bind(api, ALL_FIELDS)).map(async (page, i) => {
      await page;

      progress += idPages[i].length;

      server.push<SyncProgressUpdate>("sync-progress", {
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
  server.push<SyncProgressUpdate>("sync-progress", { type: "progress", message: `Fetching ids...` });
  const allIds = await api.getAllWorkItemIds();
  const allDeletedIdsAsync = api.getAllDeletedWorkItemIds();
  const idPages = getPages(allIds);
  server.push<SyncProgressUpdate>("sync-progress", { type: "progress", message: `Fetching item ids... found ${allIds.length} items, ${idPages.length} pages` });

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

function getSummaryMessage(syncResponse: SyncResponse): string {
  let summaryMessage = "";
  if (syncResponse.addedIds.length) summaryMessage += ` ${syncResponse.addedIds.length} added`;
  if (syncResponse.updatedIds.length) summaryMessage += ` ${syncResponse.updatedIds.length} updated`;
  if (syncResponse.deletedIds.length) summaryMessage += ` ${syncResponse.deletedIds.length} deleted`;

  if (!summaryMessage.length) summaryMessage += " No change";

  return `Sync success... ${summaryMessage}`;
}
