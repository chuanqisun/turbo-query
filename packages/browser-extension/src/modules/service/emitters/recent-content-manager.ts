import { liveQuery } from "dexie";
import { db, DbWorkItem } from "../../db/db";
import { DisplayItem, getRecentDisplayItem } from "../utils/get-display-item";
import { MetadataManager } from "./metadata-manager";

export class RecentItemsManager extends EventTarget {
  #query = () => db.workItems.orderBy("changedDate").reverse().limit(100).toArray();
  #liveQuery = liveQuery(this.#query);
  #metadataManager: MetadataManager;

  constructor(metadataManager: MetadataManager) {
    super();

    this.#metadataManager = metadataManager;
    this.#liveQuery.subscribe((items) => {
      this.dispatchEvent(
        new CustomEvent<RecentItemsChangedUpdate>("changed", { detail: { recentItems: items.map(getRecentDisplayItem.bind(null, this.#metadataManager)) } })
      );
    });
  }

  async getRecentItems(): Promise<DisplayItem[]> {
    const items = await this.#query();
    return items.map(getRecentDisplayItem.bind(null, this.#metadataManager));
  }
}

export interface RecentItemsChangedUpdate {
  recentItems: DbWorkItem[];
}
