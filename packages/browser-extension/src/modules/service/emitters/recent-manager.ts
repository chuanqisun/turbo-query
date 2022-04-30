import { liveQuery } from "dexie";
import { db, DbWorkItem } from "../../db/db";
import { DisplayItem, getRecentDisplayItem } from "../utils/get-display-item";
import { MetadataManager } from "./metadata-manager";

export class RecentManager extends EventTarget {
  #query = () => db.workItems.orderBy("changedDate").reverse().limit(100).toArray();
  #liveQuery = liveQuery(this.#query);
  #metadataManager: MetadataManager;

  constructor(metadataManager: MetadataManager) {
    super();

    this.#metadataManager = metadataManager;
  }

  async start() {
    this.#liveQuery.subscribe((items) => {
      this.dispatchEvent(
        new CustomEvent<RecentChangedUpdate>("changed", { detail: { recentItems: items.map(getRecentDisplayItem.bind(null, this.#metadataManager)) } })
      );
    });

    this.#metadataManager.addEventListener("changed", async () => {
      const recentItems = await this.#getRecentItems();
      this.dispatchEvent(new CustomEvent<RecentChangedUpdate>("changed", { detail: { recentItems } }));
    });

    console.log(`[recent-content-manager] watching for change`);
  }

  async #getRecentItems(): Promise<DisplayItem[]> {
    const items = await this.#query();
    return items.map(getRecentDisplayItem.bind(null, this.#metadataManager));
  }
}

export interface RecentChangedUpdate {
  recentItems: DbWorkItem[];
}
