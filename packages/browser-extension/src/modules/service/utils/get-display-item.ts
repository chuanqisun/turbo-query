import { DbWorkItem } from "../../db/db";
import { MetadataManager } from "../emitters/metadata-manager";
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
export function getSearchDisplayItem(isTokenMatch: (input: string) => boolean, metadataManager: MetadataManager, item: DbWorkItem): DisplayItem {
  const stateConfig = metadataManager.getStateDisplayConfig(item.workItemType, item.state);
  const iconUrl = metadataManager.getTypeIconBlobUrl(item.workItemType);

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

export function getRecentDisplayItem(metadataManager: MetadataManager, item: DbWorkItem): DisplayItem {
  const stateConfig = metadataManager.getStateDisplayConfig(item.workItemType, item.state);
  const iconUrl = metadataManager.getTypeIconBlobUrl(item.workItemType);

  return {
    ...item,
    iconUrl,
    stateColor: `#${stateConfig?.color ?? "b2b2b2"}`,
    stateCategory: stateConfig?.category ?? "Unknown",
    shortIterationPath: getShortIteration(item.iterationPath),
  };
}
