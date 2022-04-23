import type { DbWorkItem } from "../../sync/data/db";
import type { WorkItem } from "../ado/api-proxy";

export interface PageDiffSummary {
  addedIds: number[];
  dirtyIds: number[];
  cleanIds: number[];
  corruptIds: number[];
}

export function getPageDiff(remoteItems: WorkItem[], localItems: (DbWorkItem | undefined)[]): PageDiffSummary {
  const summary: PageDiffSummary = {
    addedIds: [],
    dirtyIds: [],
    cleanIds: [],
    corruptIds: [],
  };

  remoteItems.map((remote, index) => {
    const local = localItems[index];
    if (!local) {
      summary.addedIds.push(remote.id);
    } else if (remote.rev > local.rev) {
      summary.dirtyIds.push(remote.id);
    } else if (remote.rev === local.rev) {
      summary.cleanIds.push(remote.id);
    } else {
      summary.corruptIds.push(remote.id);
    }
  });

  return summary;
}
