import { HandlerContext } from "../worker";

export interface SearchRequest {
  query: string;
}
export async function handleSearch({ searchManager }: HandlerContext, { query }: SearchRequest): Promise<void> {
  await searchManager.search(query);
}
