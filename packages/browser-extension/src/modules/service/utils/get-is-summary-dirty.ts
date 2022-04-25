import { SyncResponse } from "../handlers/handle-sync";

export function isSummaryDirty(summary: SyncResponse): boolean {
  return Object.values(summary).some((value: SyncResponse[keyof SyncResponse]) => value?.length);
}
