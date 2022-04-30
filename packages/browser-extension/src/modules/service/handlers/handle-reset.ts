import { HandlerContext } from "../worker";

export async function handleReset({ indexManager, metadataManager }: HandlerContext): Promise<void> {
  await indexManager.reset();
  await metadataManager.reset();
}
