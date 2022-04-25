import { liveQuery } from "dexie";
import { db, DbWorkItem } from "../../db/db";

export class RecentItemsManager extends EventTarget {
  #query = () => db.workItems.orderBy("changedDate").reverse().limit(100).toArray();
  #liveQuery = liveQuery(this.#query);
  constructor() {
    super();

    this.#liveQuery.subscribe((items) => {
      this.dispatchEvent(new CustomEvent<RecentItemsChangedUpdate>("changed", { detail: { recentItems: items } }));
    });
  }

  async getRecentItems(): Promise<DbWorkItem[]> {
    return this.#query();
  }
}

export interface RecentItemsChangedUpdate {
  recentItems: DbWorkItem[];
}
