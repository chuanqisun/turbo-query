import FlexSearch from "flexsearch";
import { db } from "../data/db";
import { getShortIteration } from "./iteration";

export const index = new FlexSearch.Document<IndexedItem>({
  preset: "match",
  worker: true,
  charset: "latin:advanced",
  tokenize: "forward",
  document: {
    id: "id",
    index: ["fuzzyTokens"],
  },
});

export interface IndexedItem {
  id: number;
  fuzzyTokens: string;
}

export async function indexAllItems() {
  return new Promise<void>(async (resolve) => {
    let counter = 0;
    const total = await db.workItems.count();
    const onAdd = () => {
      counter++;
      if (counter == total) resolve();
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
