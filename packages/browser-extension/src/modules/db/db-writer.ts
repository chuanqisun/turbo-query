import { WorkItem } from "../worker/ado/api-proxy";
import { db } from "./db";

export async function initializeDb(allItems: WorkItem[]) {
  await db.workItems.clear();
  await putDbItems(allItems);
}

export async function putDbItems(items: WorkItem[]) {
  await db.workItems.bulkPut(
    items.map((item) => ({
      id: item.id,
      rev: item.rev,
      title: item.fields["System.Title"],
      changedDate: new Date(item.fields["System.ChangedDate"]),
      workItemType: item.fields["System.WorkItemType"],
      assignedTo: {
        displayName: item.fields["System.AssignedTo"]?.displayName ?? "Unassigned",
      },
      state: item.fields["System.State"],
      iterationPath: item.fields["System.IterationPath"],
      tags: item.fields["System.Tags"]?.split("; ") ?? [],
    }))
  );
}

export async function deleteDbItems(ids: number[]): Promise<number[]> {
  const foundItems = await db.workItems.bulkGet(ids);
  const foundIds = foundItems.filter((item) => item).map((item) => item!.id);
  await db.workItems.bulkDelete(foundIds);
  return foundIds;
}
