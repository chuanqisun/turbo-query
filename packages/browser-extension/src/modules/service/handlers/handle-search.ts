import { DisplayItem, getSearchDisplayItem } from "../utils/get-display-item";
import { isDefined } from "../utils/guard";
import { sortByState } from "../utils/sort";
import { tokenize } from "../utils/token";
import { HandlerContext } from "../worker";

export interface SearchRequest {
  query: string;
}
export interface SearchResponse {
  items: DisplayItem[];
}

export async function handleSearch({ db, indexManager }: HandlerContext, { query }: SearchRequest): Promise<SearchResponse> {
  const matches = await (await indexManager.getIndex()).searchAsync(query.trim(), { index: "fuzzyTokens" });
  const titleMatchIds = matches.map((match) => match.result).flat() ?? [];

  // TODO get item types, states, and image dictionary

  const dbItems = await db.workItems.bulkGet(titleMatchIds).then((items) => items.filter(isDefined).sort(sortByState));
  const queryTokens = tokenize(query);
  const tokenMatcher = isTokenMatch.bind(null, queryTokens);

  const matchItems = dbItems.map(getSearchDisplayItem.bind(null, tokenMatcher));

  return {
    items: matchItems,
  };
}

function isTokenMatch(queryTokens: string[], maybeToken: string) {
  return queryTokens.some((token) =>
    maybeToken
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .includes(token)
  );
}
