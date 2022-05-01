import { db, Db } from "../db/db";
import { WorkerServer } from "../ipc/server";
import { IndexManager } from "./emitters/index-manager";
import { MetadataManager } from "./emitters/metadata-manager";
import { RecentChangedUpdate, RecentManager } from "./emitters/recent-manager";
import { SearchChangedUpdate, SearchManager } from "./emitters/search-manager";
import { handleReset } from "./handlers/handle-reset";
import { handleSyncContent } from "./handlers/handle-sync-content";
import { handleSyncMetadata } from "./handlers/handle-sync-metadata";
import { handleTestConnection } from "./handlers/handle-test-connection";
import { handleWatchRecent } from "./handlers/handle-watch-recent";
import { handleSearch } from "./handlers/handle-watch-search";

class WorkerContainer {
  #server = new WorkerServer(self as any as Worker);
  #indexManager = new IndexManager();
  #metadataManager = new MetadataManager();
  #recentManager = new RecentManager(this.#metadataManager);
  #searchManager = new SearchManager(this.#metadataManager, this.#indexManager);

  async start() {
    const handlerContext: HandlerContext = {
      server: this.#server,
      indexManager: this.#indexManager,
      recentContentManager: this.#recentManager,
      metadataManager: this.#metadataManager,
      searchManager: this.#searchManager,
      db,
    };

    this.#server.addRequestHandler("sync-content", handleSyncContent.bind(null, handlerContext));
    this.#server.addRequestHandler("sync-metadata", handleSyncMetadata.bind(null, handlerContext));
    this.#server.addRequestHandler("reset", handleReset.bind(null, handlerContext));
    this.#server.addRequestHandler("test-connection", handleTestConnection.bind(null, handlerContext));
    this.#server.addRequestHandler("watch-search", handleSearch.bind(null, handlerContext));
    this.#server.addRequestHandler("watch-recent", handleWatchRecent.bind(null, handlerContext));

    this.#searchManager.addEventListener("changed", (e) => {
      this.#server.emit<SearchChangedUpdate>("search-changed", (e as CustomEvent<SearchChangedUpdate>).detail);
    });

    this.#recentManager.addEventListener("changed", (e) => {
      this.#server.emit<RecentChangedUpdate>("recent-changed", (e as CustomEvent<RecentChangedUpdate>).detail);
    });
  }
}

new WorkerContainer().start();

export interface HandlerContext {
  server: WorkerServer;
  indexManager: IndexManager;
  recentContentManager: RecentManager;
  metadataManager: MetadataManager;
  searchManager: SearchManager;
  db: Db;
}
