import { DbWorkItem } from "../../db/db";
import { getShortIteration } from "./iteration";

export function getFuzzyTitle(item: DbWorkItem) {
  return `${item.state} ${item.id} ${item.workItemType} ${item.assignedTo.displayName} ${getShortIteration(item.iterationPath)} ${item.title} ${item.tags.join(
    " "
  )}`;
}
