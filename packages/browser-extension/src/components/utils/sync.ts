import { deleteDbItems, initializeDb, putDbItems } from "../data/business-logic";
import { db } from "../data/db";
import { getPageDiff } from "./diff";
import { getPages } from "./page";
import { getAllDeletedWorkItemIds, getAllWorkItemIds, getWorkItems } from "./proxy";

export interface SyncConfig {
  onIdProgress?: (message: string) => any;
  onItemInitProgress?: (message: string) => any;
  onSyncSuccess?: (message: string) => any;
  onError?: (message: string) => any;
}
export async function sync(config?: SyncConfig) {
  try {
    config?.onIdProgress?.("Fetching item ids");
    const allIds = await getAllWorkItemIds();
    config?.onIdProgress?.(`Fetching item ids... ${allIds.length} found`);
    const allDeletedIdsAsync = getAllDeletedWorkItemIds();
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

      syncSummary.add = allItems.length;
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

    config?.onSyncSuccess?.(`Sync success... ${summaryMessage}`);
  } catch (error) {
    config?.onError?.(`Sync failed ${(error as any)?.message}`);
  }
}
