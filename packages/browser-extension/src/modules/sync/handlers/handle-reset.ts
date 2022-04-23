import { db } from "../../db/db";

export async function handleReset(): Promise<void> {
  await db.workItems.clear();
  await db.indexItems.clear();
}
