import FlexSearch, { IndexOptionsForDocumentSearch } from "flexsearch";
import { db } from "../data/db";
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

export const index = new FlexSearch.Document<IndexedItem>(indexConfig);
export const secondaryIndex = new FlexSearch.Document<IndexedItem>(indexConfig);

export interface IndexedItem {
  id: number;
  fuzzyTokens: string;
}

export async function indexAllItems() {
  return new Promise<FlexSearch.Document<IndexedItem, false>>(async (resolve) => {
    let counter = 0;
    const total = await db.workItems.count();

    const onAdd = () => {
      counter++;
      if (counter == total) resolve(index);
    };

    db.workItems.each((item) => {
      const fuzzyTokens = `${item.state} ${item.id} ${item.workItemType} ${item.assignedTo.displayName} ${getShortIteration(item.iterationPath)} ${item.title}`;

      index.addAsync(
        item.id,
        {
          id: item.id,
          fuzzyTokens,
        },
        onAdd
      );
    });
  });
}

export async function importSecondaryIndex() {
  const total = await db.indexItems.count();
  let count = 0;

  return new Promise<FlexSearch.Document<IndexedItem, false>>(async (resolve) => {
    db.indexItems.each(async (indexItem) => {
      await secondaryIndex.import(indexItem.key, indexItem.value as any);
      count++;

      if (count === total) resolve(secondaryIndex);
    });
  });
}
