import { db } from "../../db/db";
import { DisplayItem, getSearchDisplayItem } from "../utils/get-display-item";
import { isDefined } from "../utils/guard";
import { sortByState } from "../utils/sort";
import { tokenize } from "../utils/token";
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
    const queryTokens = tokenize(query);
    const tokenMatcher = this.#isTokenMatch.bind(null, queryTokens);

    const [dbItems, metadataMap] = await Promise.all([
      db.workItems.bulkGet(titleMatchIds).then((items) => items.filter(isDefined)),
      this.#metadataManager.getMap(),
    ]);

    const dbItemsSorted = dbItems.sort(sortByState.bind(null, metadataMap));
    const displayItems = dbItemsSorted.map(getSearchDisplayItem.bind(null, tokenMatcher, metadataMap));

    return displayItems;
  }

  #isTokenMatch(queryTokens: string[], maybeToken: string) {
    return queryTokens.some((token) =>
      maybeToken
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase()
        .includes(token)
    );
  }
}

export interface SearchChangedUpdate {
  items: DisplayItem[];
}
