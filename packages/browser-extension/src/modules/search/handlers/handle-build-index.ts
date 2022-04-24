import FlexSearch from "flexsearch";
import { db } from "../../db/db";
import { getShortIteration } from "../utils/iteration";
import { index, IndexedItem } from "../utils/search-index";

export async function handleBuildIndex() {
  return new Promise<FlexSearch.Document<IndexedItem, false>>(async (resolve) => {
    let counter = 0;
    const total = await db.workItems.count();

    const onAdd = () => {
      counter++;
      if (counter == total) resolve(index);
    };

    db.workItems.each((item) => {
      const fuzzyTokens = `${item.state} ${item.id} ${item.workItemType} ${item.assignedTo.displayName} ${getShortIteration(item.iterationPath)} ${
        item.title
      } ${item.tags.join(" ")}`;

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
