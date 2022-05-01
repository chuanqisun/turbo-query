import { DbWorkItem } from "../../db/db";
import { MetadataMap } from "../emitters/metadata-manager";

export function sortByState(metadata: MetadataMap, a: DbWorkItem, b: DbWorkItem): number {
  const categoryA = metadata.get(a.workItemType)?.states.get(a.state)?.category;
  const categoryB = metadata.get(b.workItemType)?.states.get(b.state)?.category;
  return getCategoryPriority(categoryA) - getCategoryPriority(categoryB);
}

// Ref: https://docs.microsoft.com/en-us/azure/devops/boards/work-items/workflow-and-state-categories
function getCategoryPriority(category?: string): number {
  switch (category) {
    case "InProgress":
      return 0;
    case "Proposed":
      return 1;

    case "Resolved":
      return 8;
    case "Completed":
      return 9;
    case "Removed":
      return 10;

    default:
      return 5;
  }
}
