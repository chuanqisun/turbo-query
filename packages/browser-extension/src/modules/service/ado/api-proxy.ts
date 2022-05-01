import { getPatHeader } from "./auth";
import { getRootQuery } from "./query";

export class ApiProxy {
  #config: Config;

  constructor(config: Config) {
    this.#config = config;
  }

  async getAllDeletedWorkItemIds(params?: QueryParams): Promise<number[]> {
    const patHeader = getPatHeader(this.#config);
    const body = JSON.stringify({ query: getRootQuery(this.#config.areaPath, true) });
    const searchParams = new URLSearchParams(`api-version=6.0`);
    if (params?.top) searchParams.set("$top", params.top.toString());

    return fetch(`https://dev.azure.com/${this.#config.org}/${this.#config.project}/_apis/wit/wiql/?${searchParams.toString()}`, {
      method: "post",
      headers: { ...patHeader, "Content-Type": "application/json" },
      body,
    })
      .then(this.#safeToJson)
      .then((result) => {
        return (result.workItems as { id: number }[]).map((item) => item.id);
      });
  }

  async getAllWorkItemIds(params?: QueryParams): Promise<number[]> {
    const patHeader = getPatHeader(this.#config);
    const body = JSON.stringify({ query: getRootQuery(this.#config.areaPath) });
    const searchParams = new URLSearchParams(`api-version=6.0`);
    if (params?.top) searchParams.set("$top", params.top.toString());

    return fetch(`https://dev.azure.com/${this.#config.org}/${this.#config.project}/_apis/wit/wiql/?${searchParams.toString()}`, {
      method: "post",
      headers: { ...patHeader, "Content-Type": "application/json" },
      body,
    })
      .then(this.#safeToJson)
      .then(async (json) => {
        return json;
      })
      .then((result) => {
        return (result.workItems as { id: number }[]).map((item) => item.id);
      });
  }

  async getWorkItemTypes(): Promise<WorkItemType[]> {
    const patHeader = getPatHeader(this.#config);

    return fetch(`https://dev.azure.com/${this.#config.org}/${this.#config.project}/_apis/wit/workitemtypes?api-version=6.0`, {
      headers: { ...patHeader },
    })
      .then(this.#safeToJson)
      .then((result: CollectionResponse<WorkItemType>) => result.value);
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
      .then(this.#safeToJson)
      .then((result: CollectionResponse<WorkItem>) => {
        return result.value;
      });
  }

  async #safeToJson(response: Response) {
    if (response.status === 401) throw new Error("Authentication error");
    if (!response.ok) throw new Error(`Status code: ${response.status}`);
    return response.json();
  }
}

export interface Config {
  org: string;
  project: string;
  areaPath: string;
  email: string;
  pat: string;
}

export interface CollectionResponse<T> {
  count: number;
  value: T[];
}

export interface WorkItem {
  id: number;
  rev: number;
  fields: BasicFields;
  url: string;
}

export interface WorkItemType {
  icon: WorkItemIcon;
  name: string;
  isDisabled: boolean;
  states: WorkItemState[];
}

export interface WorkItemIcon {
  id: string;
  url: string;
}

export interface WorkItemState {
  name: string;
  color: string;
  category: string;
}

export interface QueryParams {
  top?: number;
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
