import { SyncContentResponse } from "../handlers/handle-sync-content";
import { SyncMetadataResponse } from "../handlers/handle-sync-metadata";

export function getSummaryMessage(syncResponse: SyncContentResponse): string {
  let summaryMessage = "";
  if (syncResponse.addedIds.length) summaryMessage += ` ${syncResponse.addedIds.length} added`;
  if (syncResponse.updatedIds.length) summaryMessage += ` ${syncResponse.updatedIds.length} updated`;
  if (syncResponse.deletedIds.length) summaryMessage += ` ${syncResponse.deletedIds.length} deleted`;

  if (!summaryMessage.length) summaryMessage += " No change";

  return `Sync items... Success! (${summaryMessage.trim()})`;
}

export function getShortSummaryMessage(contentSummary: SyncContentResponse, metadataSummary?: SyncMetadataResponse): string {
  const totalContentChange = contentSummary.addedIds.length + contentSummary.deletedIds.length + contentSummary.updatedIds.length;
  const totalMetadataChange = metadataSummary?.itemTypeCount;

  let summaryMessage = "";

  if (totalContentChange > 0) summaryMessage += `${totalContentChange} content changes`;
  if (totalMetadataChange && totalContentChange > 0) summaryMessage += ` ${totalMetadataChange} metadata changes`;
  if (!summaryMessage.length) summaryMessage = "No change";

  return `Sync... Success! (${summaryMessage.trim()})`;
}
