import FlexSearch, { IndexOptionsForDocumentSearch } from "flexsearch";
import { db } from "../../db/db";
import { SyncContentResponse } from "../handlers/handle-sync-content";
import { getFuzzyTitle } from "../utils/get-fuzzy-title";
import { isDefined } from "../utils/guard";

const indexConfig: IndexOptionsForDocumentSearch<IndexedItem> = {
  preset: "default",
  charset: "latin:advanced",
  tokenize: "forward",
  document: {
    id: "id",
    index: ["fuzzyTokens"],
  },
};

// Currenly primary + secondary index because Flexsearch has performance issue when updating an imported index
// When app initially opens, we import into secondary index (quick) and enables search
// Then we build a primary index from scratch (slow). When ready, we swap out secondary and swap in primary

export class IndexManager extends EventTarget {
  #nativeIndex = new FlexSearch.Document<IndexedItem>(indexConfig);
  #importedIndex = new FlexSearch.Document<IndexedItem>(indexConfig);
  #activeIndex: IndexType | null = null;
  #initialIndexAsync = this.#importIndex();

  #resolveNativeIndexPopulated!: () => any;
  #nativeIndexPopulatedAsync = new Promise<void>((resolve) => (this.#resolveNativeIndexPopulated = resolve));

  #indexRev = 0;

  async getIndex() {
    return this.#activeIndex ?? (await this.#initialIndexAsync);
  }

  async #importIndex(): Promise<IndexType> {
    const importTasks: Promise<any>[] = [];

    await db.indexItems.each(async (indexItem) => {
      importTasks.push(this.#importedIndex.import(indexItem.key, indexItem.value as any));
    });

    await Promise.all(importTasks);

    this.#activeIndex = this.#importedIndex;
    this.dispatchEvent(new CustomEvent<IndexChangedUpdate>("changed", { detail: { rev: ++this.#indexRev } }));

    console.log(`[index-manager] imported index from ${importTasks.length} cache keys`);

    return this.#importedIndex;
  }

  async buildIndex(): Promise<IndexType> {
    await db.workItems.each((item) =>
      this.#nativeIndex.add(item.id, {
        id: item.id,
        fuzzyTokens: getFuzzyTitle(item),
      })
    );

    await this.#exportIndex();

    this.#activeIndex = this.#nativeIndex;
    this.#resolveNativeIndexPopulated();

    this.dispatchEvent(new CustomEvent<IndexChangedUpdate>("changed", { detail: { rev: ++this.#indexRev } }));

    console.log(`[index-manager] built new index`);

    return this.#importedIndex;
  }

  async updateIndex(summary: SyncContentResponse) {
    await this.#nativeIndexPopulatedAsync;

    const addedItems = (await db.workItems.bulkGet(summary.addedIds)).filter(isDefined);
    const updatedItems = (await db.workItems.bulkGet(summary.updatedIds)).filter(isDefined);

    summary.deletedIds.map((id) => this.#nativeIndex.remove(id));

    addedItems.map((item) =>
      this.#nativeIndex.add(item.id, {
        id: item.id,
        fuzzyTokens: getFuzzyTitle(item),
      })
    );

    updatedItems.map((item) =>
      this.#nativeIndex.update(item.id, {
        id: item.id,
        fuzzyTokens: getFuzzyTitle(item),
      })
    );

    this.dispatchEvent(new CustomEvent<IndexChangedUpdate>("changed", { detail: { rev: ++this.#indexRev } }));
  }

  async reset() {
    await db.indexItems.clear();
  }

  async #exportIndex() {
    // This transaction must be atomic or closing popup may lead to data loss
    console.log("[index-manager] exporting index...");
    const exportedEntries: { key: string; value: any }[] = [];
    await this.#nativeIndex.export((key, value) => exportedEntries.push({ key: key as string, value })); // HACK: key interface says it can be a number but it is actually always string
    // HACK due to https://github.com/nextapps-de/flexsearch/issues/274
    // Because Flexsearch export promise resolves prematurely,
    // We poll to ensure the largest chunk (fuzzyTokens.map) exists and then
    // give it another 1000ms to ensure everything else is saved
    await new Promise((resolve) => {
      const polling = setInterval(() => {
        if (exportedEntries.some((entry) => entry.key === "fuzzyTokens.map")) {
          // largest entry
          setTimeout(resolve, 1000); // extra delay for other entries
          clearInterval(polling);
        } else {
          // log to console for future debugging
          console.error(`[index-manager] fuzzyTokens.map missing in imported index. Will retry...`);
        }
      }, 1000);
    });
    await db.transaction("rw", db.indexItems, async () => {
      await db.indexItems.clear();
      await db.indexItems.bulkPut(exportedEntries);
    });
    console.log(`[index-manager] exported ${exportedEntries.length} cache keys`);
  }
}

export interface IndexedItem {
  id: number;
  fuzzyTokens: string;
}

export interface IndexUpdateResult {
  index: IndexType;
  rev: number;
}

export type IndexType = FlexSearch.Document<IndexedItem, false>;

export type IndexChangedUpdate = {
  rev: number;
};
