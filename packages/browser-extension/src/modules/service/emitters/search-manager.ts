import { db, DbWorkItem } from "../../db/db";
import { DisplayItem, getSearchDisplayItem } from "../utils/get-display-item";
import { getFuzzyTitle } from "../utils/get-fuzzy-title";
import { isDefined } from "../utils/guard";
import { sortByState } from "../utils/sort";
import { normalizeUnicode } from "../utils/string";
import { IndexManager } from "./index-manager";
import { MetadataManager } from "./metadata-manager";

export class SearchManager extends EventTarget {
  #metadataManager: MetadataManager;
  #indexManager: IndexManager;
  #activeQuery = "";
  #isStarted = false;

  constructor(metadataManager: MetadataManager, indexManager: IndexManager) {
    super();

    this.#metadataManager = metadataManager;
    this.#indexManager = indexManager;
  }

  #start() {
    this.#indexManager.addEventListener("changed", async () => {
      const items = await this.getQueryResults(this.#activeQuery);
      this.dispatchEvent(
        new CustomEvent<SearchChangedUpdate>("changed", {
          detail: {
            items,
          },
        })
      );
    });

    this.#metadataManager.addEventListener("changed", async () => {
      const items = await this.getQueryResults(this.#activeQuery);
      this.dispatchEvent(
        new CustomEvent<SearchChangedUpdate>("changed", {
          detail: {
            items,
          },
        })
      );
    });

    this.#isStarted = true;
    console.log(`[search-manager] watching for change`);
  }

  async search(query: string): Promise<DisplayItem[]> {
    if (!this.#isStarted) {
      this.#start();
    }

    this.#activeQuery = query.trim();
    return this.getQueryResults(this.#activeQuery);
  }

  async getQueryResults(query: string): Promise<DisplayItem[]> {
    if (!query.length) {
      this.dispatchEvent(
        new CustomEvent<SearchChangedUpdate>("changed", {
          detail: {
            items: [],
          },
        })
      );
    }

    const matches = await (await this.#indexManager.getIndex()).searchAsync(query, { index: "fuzzyTokens" });
    const titleMatchIds = matches.map((match) => match.result).flat() ?? [];
    const fieldMatchTokens = this.#getFieldMatchTokens(query);
    const strictMatchTokens = this.#getStrictMatchTokens(query);
    const titleMatchTokens = this.#getTitleMatchTokens(query);
    let pattern: RegExp | undefined;
    try {
      pattern = new RegExp(`(${titleMatchTokens.join("|")})`, "gi");
    } catch (e) {
      console.log(`[search-manager], RegExp error, skip title highlighting`, e);
    }

    const tokenMatcher = this.#isTokenMatch.bind(null, fieldMatchTokens);
    const titleHighlighter = pattern ? this.#highlightFullText.bind(null, pattern) : (title: string) => title;

    const [dbItems, metadataMap] = await Promise.all([
      db.workItems.bulkGet(titleMatchIds).then((items) => items.filter(isDefined)),
      this.#metadataManager.getMap(),
    ]);

    const dbItemsSorted = dbItems.filter(this.#isStrictMatched.bind(this, strictMatchTokens)).sort(sortByState.bind(null, metadataMap));
    const displayItems = dbItemsSorted.map(getSearchDisplayItem.bind(null, titleHighlighter, tokenMatcher, metadataMap));

    return displayItems;
  }

  #isStrictMatched(strictMatchTokens: string[], dbItem: DbWorkItem) {
    const fuzzyTitleNormalized = normalizeUnicode(getFuzzyTitle(dbItem));
    const fuzzyTitleCaseInsensitive = fuzzyTitleNormalized.toLocaleLowerCase();
    return strictMatchTokens.every((token) => (this.#hasUpperCase(token) ? fuzzyTitleNormalized.includes(token) : fuzzyTitleCaseInsensitive.includes(token)));
  }

  #isTokenMatch(queryTokens: string[], maybeToken: string) {
    return queryTokens.some((token) => normalizeUnicode(maybeToken).toLocaleLowerCase().includes(token));
  }

  #highlightFullText(pattern: RegExp, title: string) {
    return title.replace(pattern, (match) => `<mark>${match}</mark>`);
  }

  #hasUpperCase(input: string): boolean {
    return input.toLocaleLowerCase() !== input;
  }

  #getFieldMatchTokens(input: string): string[] {
    return normalizeUnicode(input)
      .toLocaleLowerCase()
      .replace(/\s+/g, " ")
      .replace(/"/g, "")
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length);
  }

  #getTitleMatchTokens(input: string): string[] {
    return input
      .replace(/\s+/g, " ")
      .replace(/"/g, "")
      .replace(/[#-.]|[[-^]|[?|{}]/g, "\\$&") // regex escapes, ref: https://stackoverflow.com/questions/6300183/sanitize-string-of-regex-characters-before-regexp-build
      .split(" ")
      .filter((token) => token.length);
  }

  /** Get all the phrases between quotes */
  #getStrictMatchTokens(input: string): string[] {
    return [...input.matchAll(/"(.+?)"/g)].map((matchResult) => normalizeUnicode(matchResult[1]));
  }
}

export interface SearchChangedUpdate {
  items: DisplayItem[];
}
