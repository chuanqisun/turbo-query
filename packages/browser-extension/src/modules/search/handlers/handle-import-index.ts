import FlexSearch from "flexsearch";
import { db } from "../../db/db";
import { cachedIndex, IndexedItem } from "../utils/search-index";

export async function handleImportIndex() {
  const total = await db.indexItems.count();
  let count = 0;

  return new Promise<FlexSearch.Document<IndexedItem, false>>(async (resolve) => {
    db.indexItems.each(async (indexItem) => {
      await cachedIndex.import(indexItem.key, indexItem.value as any);
      count++;

      if (count === total) resolve(cachedIndex);
    });
  });
}
