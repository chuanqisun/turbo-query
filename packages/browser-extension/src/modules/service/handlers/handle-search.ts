import { DbWorkItem } from "../../db/db";
import { isDefined } from "../utils/guard";
import { sortByState } from "../utils/sort";
import { HandlerContext } from "../worker";

export interface SearchRequest {
  query: string;
}
export interface SearchResponse {
  items: SearchResultItem[];
}

export interface SearchResultItem extends DbWorkItem {} // TODO: add highlight

export async function handleSearch({ db, indexManager }: HandlerContext, { query }: SearchRequest): Promise<SearchResponse> {
  const matches = await (await indexManager.getIndex()).searchAsync(query.trim(), { index: "fuzzyTokens" });
  const titleMatchIds = matches.map((match) => match.result).flat() ?? [];

  const dbItems = await db.workItems.bulkGet(titleMatchIds).then((items) => items.filter(isDefined).sort(sortByState));

  return {
    items: dbItems,
  };
}
