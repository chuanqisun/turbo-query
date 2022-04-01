import { useEffect } from "react";
import { patHeader } from "./shared/auth";
import { env } from "./shared/env";

export const WorkItemList = () => {
  useEffect(() => {
    getAllItems();
  }, []);

  return <div>WorkItemList</div>;
};

async function getAllItems() {
  const start = performance.now();
  const allIds = await getAllWorkItemIds();
  const pagedIds = getPagedIds(allIds);

  const pages = await Promise.all(
    pagedIds.map(async (ids) => {
      const items = await getWorkItems(["System.Title", "System.WorkItemType"], ids);
      return items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    })
  );

  const allItems = pages.flat();

  const duration = performance.now() - start;
  console.log((duration / 1000).toFixed(2));

  return allItems;
}

function getAllWorkItemIds(): Promise<number[]> {
  return fetch(`https://dev.azure.com/Microsoft/OS/HITS/_apis/wit/wiql/${env.rootQueryId}?api-version=6.0`, {
    headers: { ...patHeader },
  })
    .then((result) => result.json())
    .then((result) => {
      return (result.workItems as { id: number }[]).map((item) => item.id);
    });
}

function getWorkItems(fields: string[], ids: number[]): Promise<WorkItem<BasicFields>[]> {
  return fetch(`https://dev.azure.com/Microsoft/OS/_apis/wit/workitemsbatch?api-version=6.0`, {
    method: "post",
    headers: { ...patHeader, "Content-Type": "application/json" },
    body: JSON.stringify({
      ids,
      fields,
    }),
  })
    .then((result) => result.json())
    .then((result: BatchSummary<BasicFields>) => {
      return result.value;
    });
}

function getPagedIds(allIds: number[]): number[][] {
  const pages: number[][] = [];
  for (var i = 0; i < allIds.length; i += 200) pages.push(allIds.slice(i, i + 200));
  return pages;
}

interface BatchSummary<FieldsType extends {}> {
  count: number;
  value: WorkItem<FieldsType>[];
}

interface WorkItem<FieldsType extends {}> {
  id: number;
  rev: number;
  fields: FieldsType;
  url: string;
}

interface BasicFields {
  "System.Title": string;
  "System.WorkItemType": string;
}
