import { DisplayItem } from "../utils/get-display-item";
import { HandlerContext } from "../worker";

export interface SearchRequest {
  query: string;
}

export interface SearchResponse {
  items: DisplayItem[];
}
export async function handleSearch({ searchManager }: HandlerContext, { query }: SearchRequest): Promise<SearchResponse> {
  return {
    items: await searchManager.search(query),
  };
}
