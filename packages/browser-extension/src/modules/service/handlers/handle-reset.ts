import { HandlerContext } from "../worker";

export async function handleReset({ indexManager, metadataManager, db }: HandlerContext): Promise<void> {
  await indexManager.reset();
  await metadataManager.reset();
  await db.workItems.clear();
}
