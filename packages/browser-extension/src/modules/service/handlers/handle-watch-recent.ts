import { HandlerContext } from "../worker";

export async function handleWatchRecent({ recentContentManager }: HandlerContext): Promise<void> {
  await recentContentManager.start();
}
