import { SyncContentResponse } from "../handlers/handle-sync-content";

export function getSummaryMessage(syncResponse: SyncContentResponse): string {
  let summaryMessage = "";
  if (syncResponse.addedIds.length) summaryMessage += ` ${syncResponse.addedIds.length} added`;
  if (syncResponse.updatedIds.length) summaryMessage += ` ${syncResponse.updatedIds.length} updated`;
  if (syncResponse.deletedIds.length) summaryMessage += ` ${syncResponse.deletedIds.length} deleted`;

  if (!summaryMessage.length) summaryMessage += " No change";

  return `Sync items... Success! (${summaryMessage.trim()})`;
}
