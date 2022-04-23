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
  tags: string[];
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
    this.version(3)
      .stores({
        workItems: "id, title, changedDate",
        indexItems: "key",
      })
      .upgrade((tx) => {
        // Reset DB to add Tags
        console.log("[DB] Migration: 2->3");
        tx.db.table("workItems").clear();
      });
  }
}

export const db = new Db();
