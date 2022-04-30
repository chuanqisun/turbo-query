import Dexie, { Table } from "dexie";

export class Db extends Dexie {
  workItems!: Table<DbWorkItem>;
  workItemTypes!: Table<DbWorkItemType>;
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
    this.version(4).stores({
      workItemTypes: "name",
    });
  }
}

export const db = new Db();

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

export interface DbWorkItemType {
  name: string;
  icon: {
    url: string;
    image: Blob;
  };
  states: DbWorkItemState[];
}

export interface DbWorkItemState {
  name: string;
  color: string;
  category: string;
}

export interface DbIndexItem {
  key: string;
  value: string | undefined;
}

export interface DbUser {
  displayName: string;
}
