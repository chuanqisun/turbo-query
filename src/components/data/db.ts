import Dexie, { Table } from "dexie";

export interface DbWorkItem {
  id: number;
  rev: number;
  title: string;
  workItemType: string;
  changedDate: Date;
}

export class Db extends Dexie {
  workItems!: Table<DbWorkItem>;

  constructor() {
    super("adohpc_store");
    this.version(1).stores({
      workItems: "id, title, workItemType, changedDate",
    });
  }
}

export const db = new Db();