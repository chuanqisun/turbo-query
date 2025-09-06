import { DbWorkItem } from "../../db/db";
import { getShortIteration } from "./iteration";

export function getFuzzyTitle(item: DbWorkItem) {
  // Place ID at the beginning and add it again after workItemType to ensure it's always findable
  // This addresses potential issues with FlexSearch tokenization for multi-word work item types
  return `${item.id} ${item.state} ${item.id} ${item.workItemType} ${item.id} ${item.assignedTo.displayName} ${getShortIteration(item.iterationPath)} ${item.title} ${item.tags.join(
    " "
  )}`;
}
