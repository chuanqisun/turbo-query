import { DbWorkItem } from "../../db/db";
import { getShortIteration } from "./iteration";

export interface DisplayItem extends DbWorkItem {
  shortIterationPath: string;
  isIdMatched?: boolean;
  isWorkItemTypeMatched?: boolean;
  isAssignedToUserMatched?: boolean;
  isStateMatched?: boolean;
  isShortIterationPathMatched?: boolean;
  isTagMatched?: boolean[];
}
export function getSearchDisplayItem(isTokenMatch: (input: string) => boolean, item: DbWorkItem): DisplayItem {
  return {
    ...item,
    shortIterationPath: getShortIteration(item.iterationPath),
    isIdMatched: isTokenMatch(item.id.toString()),
    isWorkItemTypeMatched: isTokenMatch(item.workItemType),
    isAssignedToUserMatched: isTokenMatch(item.assignedTo.displayName),
    isStateMatched: isTokenMatch(item.state),
    isShortIterationPathMatched: isTokenMatch(getShortIteration(item.iterationPath)),
    isTagMatched: item.tags.map((tag) => isTokenMatch(tag)),
  };
}

export function getRecentDisplayItem(item: DbWorkItem): DisplayItem {
  return {
    ...item,
    shortIterationPath: getShortIteration(item.iterationPath),
  };
}
