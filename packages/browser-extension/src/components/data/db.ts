import Dexie, { Table } from "dexie";

export interface DbWorkItem {
  id: number;
  rev: number;
  title: string;
  workItemType: string;
  changedDate: Date;
  assignedTo: DbUser;
  state: string;
  iterationPath: string;
}

export interface DbIndexItem {
  key: string;
  value: string | undefined;
}

export interface DbUser {
  displayName: string;
}

export class Db extends Dexie {
  workItems!: Table<DbWorkItem>;
  indexItems!: Table<DbIndexItem>;

  constructor() {
    super("adohpc_store");
    this.version(2).stores({
      workItems: "id, title, changedDate",
      indexItems: "key",
    });
  }
}

export const db = new Db();
