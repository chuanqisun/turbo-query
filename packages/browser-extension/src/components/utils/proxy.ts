import { getPatHeader } from "./auth";
import { getConfig } from "./config";
import { getRootQuery } from "./query";

export interface BatchSummary {
  count: number;
  value: WorkItem[];
}

export interface WorkItem {
  id: number;
  rev: number;
  fields: BasicFields;
  url: string;
}

export interface BasicFields {
  "System.Title": string;
  "System.WorkItemType": string;
  "System.ChangedDate": string;
  "System.AssignedTo": AdoUser;
  "System.State": string;
  "System.IterationPath": string;
}
export interface AdoUser {
  displayName: string;
}

export async function getAllDeletedWorkItemIds(): Promise<number[]> {
  const config = await getConfig();
  const patHeader = getPatHeader(config);
  const body = JSON.stringify({ query: getRootQuery(config.areaPath, true) });

  return fetch(`https://dev.azure.com/${config.org}/${config.project}/_apis/wit/wiql/?api-version=6.0`, {
    method: "post",
    headers: { ...patHeader, "Content-Type": "application/json" },
    body,
  })
    .then((result) => result.json())
    .then((result) => {
      return (result.workItems as { id: number }[]).map((item) => item.id);
    });
}

export async function getAllWorkItemIds(): Promise<number[]> {
  const config = await getConfig();
  const patHeader = getPatHeader(config);
  const body = JSON.stringify({ query: getRootQuery(config.areaPath) });

  return fetch(`https://dev.azure.com/${config.org}/${config.project}/_apis/wit/wiql/?api-version=6.0`, {
    method: "post",
    headers: { ...patHeader, "Content-Type": "application/json" },
    body,
  })
    .then(async (result) => {
      const json = await result.json();
      if (!result.ok) throw new Error((json as any)?.message ?? "Error getting work items");
      return json;
    })
    .then((result) => {
      return (result.workItems as { id: number }[]).map((item) => item.id);
    });
}

export async function getWorkItems(fields: string[], ids: number[]): Promise<WorkItem[]> {
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
