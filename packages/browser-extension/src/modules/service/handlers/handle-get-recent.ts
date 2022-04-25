import { DbWorkItem } from "../../db/db";
import { HandlerContext } from "../worker";

export interface RecentItemsResponse {
  items: DbWorkItem[];
}

export async function handleRecentItems({ recentContentManager }: HandlerContext): Promise<RecentItemsResponse> {
  const items = await recentContentManager.getRecentItems();
  return {
    items,
  };
}
