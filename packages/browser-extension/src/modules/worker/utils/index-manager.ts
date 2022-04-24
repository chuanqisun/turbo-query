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

export interface IndexedItem {
  id: number;
  fuzzyTokens: string;
}

export class IndexManager extends EventTarget {
  #nativeIndex = new FlexSearch.Document<IndexedItem>(indexConfig);
  #importedIndex = new FlexSearch.Document<IndexedItem>(indexConfig);
  #activeIndex: FlexSearch.Document<IndexedItem, false> | null = null;

  constructor() {
    super();

    this.#importIndex();
  }

  get index() {
    if (!this.#activeIndex) throw new Error("No index is selected. Import or build the index first.");
    return this.#activeIndex;
  }

  async #importIndex() {
    const importTasks: Promise<any>[] = [];

    await db.indexItems.each(async (indexItem) => {
      importTasks.push(this.#importedIndex.import(indexItem.key, indexItem.value as any));
    });

    await Promise.all(importTasks);

    this.#activeIndex = this.#importedIndex;
    this.dispatchEvent(new CustomEvent("changed"));

    return this.#importedIndex;
  }

  async buildIndex() {
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
    this.dispatchEvent(new CustomEvent("changed"));

    return this.#nativeIndex;
  }

  async #exportIndex() {
    await db.indexItems.clear();
    await this.#nativeIndex.export((key, value) => db.indexItems.put({ key: key as string, value: value as any as string | undefined }));
  }
}
