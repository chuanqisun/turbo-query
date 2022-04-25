import FlexSearch, { IndexOptionsForDocumentSearch } from "flexsearch";
import { db } from "../../db/db";
import { SyncResponse } from "../handlers/handle-sync";
import { getFuzzyTitle } from "../utils/get-fuzzy-title";
import { isDefined } from "../utils/guard";

const indexConfig: IndexOptionsForDocumentSearch<IndexedItem> = {
  preset: "match",
  worker: true,
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

    return this.#importedIndex;
  }

  async updateIndex(summary: SyncResponse) {
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

  async #exportIndex() {
    await db.indexItems.clear();
    await this.#nativeIndex.export((key, value) => db.indexItems.put({ key: key as string, value: value as any as string | undefined }));
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
