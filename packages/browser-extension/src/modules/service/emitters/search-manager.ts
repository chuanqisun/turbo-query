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
    this.#indexManager.addEventListener("changed", () => {
      this.executeQuery(this.#activeQuery);
    });

    this.#metadataManager.addEventListener("changed", () => {
      this.executeQuery(this.#activeQuery);
    });

    this.#isStarted = true;
    console.log(`[search-manager] watching for change`);
  }

  async search(query: string): Promise<void> {
    if (!this.#isStarted) {
      this.#start();
    }

    this.#activeQuery = query.trim();
    await this.executeQuery(this.#activeQuery);
  }

  async executeQuery(query: string) {
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

    const dbItems = await db.workItems.bulkGet(titleMatchIds).then((items) => items.filter(isDefined).sort(sortByState));
    const queryTokens = tokenize(query);
    const tokenMatcher = this.#isTokenMatch.bind(null, queryTokens);

    const matchItems = dbItems.map(getSearchDisplayItem.bind(null, tokenMatcher, this.#metadataManager));

    this.dispatchEvent(
      new CustomEvent<SearchChangedUpdate>("changed", {
        detail: {
          items: matchItems,
        },
      })
    );
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
