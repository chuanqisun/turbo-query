import { db } from "../../db/db";
import { DisplayItem, getSearchDisplayItem } from "../utils/get-display-item";
import { isDefined } from "../utils/guard";
import { sortByState } from "../utils/sort";
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
    const queryTokens = this.#tokenize(query);
    const queryTokensExact = this.#tokenizeExact(query);
    const pattern = new RegExp(`(${queryTokensExact.join("|")})`, "gi");

    const tokenMatcher = this.#isTokenMatch.bind(null, queryTokens);
    const titleHighlighter = this.#highlightFullText.bind(null, pattern);

    const [dbItems, metadataMap] = await Promise.all([
      db.workItems.bulkGet(titleMatchIds).then((items) => items.filter(isDefined)),
      this.#metadataManager.getMap(),
    ]);

    const dbItemsSorted = dbItems.sort(sortByState.bind(null, metadataMap));
    const displayItems = dbItemsSorted.map(getSearchDisplayItem.bind(null, titleHighlighter, tokenMatcher, metadataMap));

    console.log(displayItems);
    return displayItems;
  }

  #isTokenMatch(queryTokens: string[], maybeToken: string) {
    return queryTokens.some((token) =>
      maybeToken
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "") // remove accent step 2
        .toLocaleLowerCase()
        .includes(token)
    );
  }

  #highlightFullText(pattern: RegExp, title: string) {
    return title.replace(pattern, (match) => `<mark>${match}</mark>`);
  }

  #tokenize(input: string): string[] {
    // Ref and credit: https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
    return input
      .normalize("NFD") // remove accent step 1
      .replace(/\p{Diacritic}/gu, "") // remove accent step 2
      .replace(/\s+/g, " ")
      .split(" ")
      .map((token) => token.toLocaleLowerCase().trim())
      .filter((token) => token.length);
  }

  #tokenizeExact(input: string): string[] {
    return input
      .replace(/\s+/g, " ")
      .split(" ")
      .filter((token) => token.length);
  }
}

export interface SearchChangedUpdate {
  items: DisplayItem[];
}
