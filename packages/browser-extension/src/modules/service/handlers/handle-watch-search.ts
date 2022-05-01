import { HandlerContext } from "../worker";

export interface SearchRequest {
  query: string;
  timestamp: number;
}
export async function handleSearch({ searchManager }: HandlerContext, { query, timestamp }: SearchRequest): Promise<void> {
  await searchManager.search(query);
}
