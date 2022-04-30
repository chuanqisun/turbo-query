import { HandlerContext } from "../worker";

export interface SearchRequest {
  query: string;
  timestamp: number;
}
export async function handleSearch({ searchManager }: HandlerContext, { query, timestamp }: SearchRequest): Promise<void> {
  // TODO use timestamp and queue to ensure response ordering and skip stale queries
  await searchManager.search(query);
}
