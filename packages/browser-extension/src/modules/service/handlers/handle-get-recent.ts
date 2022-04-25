import { DisplayItem } from "../utils/get-display-item";
import { HandlerContext } from "../worker";

export interface RecentItemsResponse {
  items: DisplayItem[];
}

export async function handleRecentItems({ recentContentManager }: HandlerContext): Promise<RecentItemsResponse> {
  const items = await recentContentManager.getRecentItems();
  return {
    items,
  };
}
