import { SyncContentResponse } from "../handlers/handle-sync-content";

export function isSummaryDirty(summary: SyncContentResponse): boolean {
  return Object.values(summary).some((value: SyncContentResponse[keyof SyncContentResponse]) => value?.length);
}
