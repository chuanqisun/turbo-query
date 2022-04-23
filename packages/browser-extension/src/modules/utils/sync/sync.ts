import { db } from "../../data/db";
import { ALL_FIELDS, ApiProxy } from "../ado/api-proxy";
import { deleteDbItems, initializeDb, putDbItems } from "./db-writer";
import { getPageDiff } from "./diff";
import { getPages } from "./page";

export interface SyncCallbacks {
  onIdProgress?: (message: string) => any;
  onItemInitProgress?: (message: string) => any;
  onSyncSuccess?: (message: string) => any;
  onError?: (message: string) => any;
}
export async function sync(api: ApiProxy, callbacks?: SyncCallbacks) {
  try {
    callbacks?.onIdProgress?.("Fetching item ids...");
    const allIds = await api.getAllWorkItemIds();
    callbacks?.onIdProgress?.(`Fetching item ids... ${allIds.length} found`);
    const allDeletedIdsAsync = api.getAllDeletedWorkItemIds();
    const idPages = getPages(allIds);
    console.log(`[sync] ${allIds.length} items, ${idPages.length} pages`);

    const syncSummary = {
      add: 0,
      delete: 0,
      update: 0,
    };

    const count = await db.workItems.count();

    if (!count) {
      let progress = 0;
      const pages = await Promise.all(
        idPages.map(api.getWorkItems.bind(null, ALL_FIELDS)).map(async (page, i) => {
          await page;

          progress += idPages[i].length;

          callbacks?.onIdProgress?.(`Fetching item content: ${((progress / allIds.length) * 100).toFixed(2)}%`);

          return page;
        })
      );
      const allItems = pages.flat();
      await initializeDb(allItems);
      console.log(`[sync] populated with all dataset`);

      syncSummary.add = allItems.length;
    } else {
      for (const [index, ids] of idPages.entries()) {
        const remoteItems = await api.getWorkItems(ALL_FIELDS, ids);

        const localItems = await db.workItems.bulkGet(remoteItems.map((item) => item.id));

        const syncPlan = getPageDiff(remoteItems, localItems);
        console.log(`[sync] page ${index}: +${syncPlan.addedIds.length} !${syncPlan.dirtyIds.length} *${syncPlan.cleanIds.length}`);
        if (syncPlan.corruptIds.length) throw new Error("Data corrupted");

        const addedItems = remoteItems.filter((item) => syncPlan.addedIds.includes(item.id));
        const dirtItems = remoteItems.filter((item) => syncPlan.dirtyIds.includes(item.id));

        await putDbItems(addedItems);
        await putDbItems(dirtItems);

        syncSummary.add += addedItems.length;
        syncSummary.update += dirtItems.length;

        // local items more recent than MRCI is either dirty or deleted
        if (syncPlan.cleanIds.length) {
          break;
        }
      }

      const allDeletedIds = await allDeletedIdsAsync;
      const deletedIds = await deleteDbItems(allDeletedIds);

      syncSummary.delete += deletedIds.length;

      console.log(`[sync] deleted ${deletedIds.length}`);
    }

    let summaryMessage = "";
    if (syncSummary.add) summaryMessage += ` ${syncSummary.add} added`;
    if (syncSummary.update) summaryMessage += ` ${syncSummary.update} updated`;
    if (syncSummary.delete) summaryMessage += ` ${syncSummary.delete} deleted`;

    if (!summaryMessage.length) summaryMessage = "No change";

    callbacks?.onSyncSuccess?.(`Sync success... ${summaryMessage}`);
  } catch (error) {
    console.error(error);
    callbacks?.onError?.(`Sync failed ${(error as any)?.message}`);
  }
}
