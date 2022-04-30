import { DbWorkItem } from "../../db/db";
import { MetadataMap } from "../emitters/metadata-manager";
import { getShortIteration } from "./iteration";

export interface DisplayItem extends DbWorkItem {
  iconUrl?: string;
  isIdMatched?: boolean;
  isWorkItemTypeMatched?: boolean;
  isAssignedToUserMatched?: boolean;
  isStateMatched?: boolean;
  isShortIterationPathMatched?: boolean;
  isTagMatched?: boolean[];
  shortIterationPath: string;
  stateColor: string;
  stateCategory: string;
}
export function getSearchDisplayItem(isTokenMatch: (input: string) => boolean, metadataMap: MetadataMap, item: DbWorkItem): DisplayItem {
  const iconUrl = metadataMap.get(item.workItemType)?.iconBlobUrl;
  const stateConfig = metadataMap.get(item.workItemType)?.states.get(item.state);

  return {
    ...item,
    iconUrl,
    isIdMatched: isTokenMatch(item.id.toString()),
    isWorkItemTypeMatched: isTokenMatch(item.workItemType),
    isAssignedToUserMatched: isTokenMatch(item.assignedTo.displayName),
    isStateMatched: isTokenMatch(item.state),
    isShortIterationPathMatched: isTokenMatch(getShortIteration(item.iterationPath)),
    isTagMatched: item.tags.map((tag) => isTokenMatch(tag)),
    stateColor: `#${stateConfig?.color ?? "b2b2b2"}`,
    stateCategory: stateConfig?.category ?? "Unknown",
    shortIterationPath: getShortIteration(item.iterationPath),
  };
}

export function getRecentDisplayItem(metadataMap: MetadataMap, item: DbWorkItem): DisplayItem {
  const iconUrl = metadataMap.get(item.workItemType)?.iconBlobUrl;
  const stateConfig = metadataMap.get(item.workItemType)?.states.get(item.state);

  return {
    ...item,
    iconUrl,
    stateColor: `#${stateConfig?.color ?? "b2b2b2"}`,
    stateCategory: stateConfig?.category ?? "Unknown",
    shortIterationPath: getShortIteration(item.iterationPath),
  };
}
