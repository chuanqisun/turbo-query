import { liveQuery } from "dexie";
import { db } from "../../db/db";
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
    this.#liveQuery.subscribe(async (items) => {
      const metadataMap = await this.#metadataManager.getMap();
      this.dispatchEvent(new CustomEvent<RecentChangedUpdate>("changed", { detail: { recentItems: items.map(getRecentDisplayItem.bind(null, metadataMap)) } }));
    });

    this.#metadataManager.addEventListener("changed", async () => {
      const recentItems = await this.#getRecentItems();
      this.dispatchEvent(new CustomEvent<RecentChangedUpdate>("changed", { detail: { recentItems } }));
    });

    console.log(`[recent-content-manager] watching for change`);
  }

  async #getRecentItems(): Promise<DisplayItem[]> {
    const [items, metadataMap] = await Promise.all([this.#query(), this.#metadataManager.getMap()]);

    return items.map(getRecentDisplayItem.bind(null, metadataMap));
  }
}

export interface RecentChangedUpdate {
  recentItems: DisplayItem[];
}
