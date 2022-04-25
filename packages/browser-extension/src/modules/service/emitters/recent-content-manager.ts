import { liveQuery } from "dexie";
import { db, DbWorkItem } from "../../db/db";
import { DisplayItem, getRecentDisplayItem } from "../utils/get-display-item";

export class RecentItemsManager extends EventTarget {
  #query = () => db.workItems.orderBy("changedDate").reverse().limit(100).toArray();
  #liveQuery = liveQuery(this.#query);
  constructor() {
    super();

    this.#liveQuery.subscribe((items) => {
      this.dispatchEvent(new CustomEvent<RecentItemsChangedUpdate>("changed", { detail: { recentItems: items.map(getRecentDisplayItem) } }));
    });
  }

  async getRecentItems(): Promise<DisplayItem[]> {
    const items = await this.#query();
    return items.map(getRecentDisplayItem);
  }
}

export interface RecentItemsChangedUpdate {
  recentItems: DbWorkItem[];
}
