import FlexSearch, { IndexOptionsForDocumentSearch } from "flexsearch";
import { db } from "../../db/db";
import { getShortIteration } from "./iteration";

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
  #indexRev = 0;

  async getIndex() {
    return this.#activeIndex ?? (await this.#initialIndexAsync);
  }

  async #importIndex(): Promise<IndexType> {
    const importTasks: Promise<any>[] = [];

    performance.mark("import");
    await db.indexItems.each(async (indexItem) => {
      importTasks.push(this.#importedIndex.import(indexItem.key, indexItem.value as any));
    });

    await Promise.all(importTasks);
    console.log(performance.measure("i", "import").duration);

    this.#activeIndex = this.#importedIndex;
    this.dispatchEvent(new CustomEvent<IndexChangedEventDetail>("changed", { detail: { rev: ++this.#indexRev } }));

    return this.#importedIndex;
  }

  async buildIndex(): Promise<IndexType> {
    await db.workItems.each((item) => {
      const fuzzyTokens = `${item.state} ${item.id} ${item.workItemType} ${item.assignedTo.displayName} ${getShortIteration(item.iterationPath)} ${
        item.title
      } ${item.tags.join(" ")}`;

      this.#nativeIndex.add(item.id, {
        id: item.id,
        fuzzyTokens,
      });
    });

    await this.#exportIndex();
    this.#activeIndex = this.#nativeIndex;
    this.dispatchEvent(new CustomEvent<IndexChangedEventDetail>("changed", { detail: { rev: ++this.#indexRev } }));

    return this.#importedIndex;
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

export interface IndexChangedEventDetail {
  rev: number;
}

export type IndexChangedUpdate = {
  rev: number;
};
