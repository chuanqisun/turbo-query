import { getPatHeader } from "./auth";
import { getRootQuery } from "./query";

export class ApiProxy {
  #config: Config;

  constructor(config: Config) {
    this.#config = config;
  }

  async getAllDeletedWorkItemIds(): Promise<number[]> {
    const patHeader = getPatHeader(this.#config);
    const body = JSON.stringify({ query: getRootQuery(this.#config.areaPath, true) });

    return fetch(`https://dev.azure.com/${this.#config.org}/${this.#config.project}/_apis/wit/wiql/?api-version=6.0`, {
      method: "post",
      headers: { ...patHeader, "Content-Type": "application/json" },
      body,
    })
      .then((result) => result.json())
      .then((result) => {
        return (result.workItems as { id: number }[]).map((item) => item.id);
      });
  }

  async getAllWorkItemIds(): Promise<number[]> {
    const patHeader = getPatHeader(this.#config);
    const body = JSON.stringify({ query: getRootQuery(this.#config.areaPath) });

    return fetch(`https://dev.azure.com/${this.#config.org}/${this.#config.project}/_apis/wit/wiql/?api-version=6.0`, {
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

  async getWorkItems(fields: string[], ids: number[]): Promise<WorkItem[]> {
    const patHeader = getPatHeader(this.#config);

    return fetch(`https://dev.azure.com/${this.#config.org}/${this.#config.project}/_apis/wit/workitemsbatch?api-version=6.0`, {
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
}

export interface Config {
  org: string;
  project: string;
  areaPath: string;
  email: string;
  pat: string;
}

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
  "System.AssignedTo"?: AdoUser; // Abscent when unassigned
  "System.State": string;
  "System.IterationPath": string;
  "System.Tags"?: string; // Abscent when untagged
}

export const ALL_FIELDS: (keyof BasicFields)[] = [
  "System.Title",
  "System.WorkItemType",
  "System.ChangedDate",
  "System.AssignedTo",
  "System.State",
  "System.IterationPath",
  "System.Tags",
];

export interface AdoUser {
  displayName: string;
}
