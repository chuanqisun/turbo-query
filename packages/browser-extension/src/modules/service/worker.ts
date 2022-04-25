import { db, Db } from "../db/db";
import { WorkerServer } from "../ipc/server";
import { IndexChangedUpdate, IndexManager } from "./emitters/index-manager";
import { RecentItemsChangedUpdate, RecentItemsManager } from "./emitters/recent-content-manager";
import { handleRecentItems } from "./handlers/handle-get-recent";
import { handleReset } from "./handlers/handle-reset";
import { handleSearch } from "./handlers/handle-search";
import { handleSync } from "./handlers/handle-sync";
import { handleTestConnection } from "./handlers/handle-test-connection";

class WorkerContainer {
  #server = new WorkerServer(self as any as Worker);
  #indexManager = new IndexManager();
  #recentItemsManager = new RecentItemsManager();

  async start() {
    const handlerContext: HandlerContext = {
      server: this.#server,
      indexManager: this.#indexManager,
      recentContentManager: this.#recentItemsManager,
      db,
    };

    this.#server.addRequestHandler("recent-items", handleRecentItems.bind(null, handlerContext));

    this.#server.addRequestHandler("sync", handleSync.bind(null, handlerContext));
    this.#server.addRequestHandler("reset", handleReset.bind(null, handlerContext));
    this.#server.addRequestHandler("test-connection", handleTestConnection.bind(null, handlerContext));

    this.#server.addRequestHandler("search", handleSearch.bind(null, handlerContext));

    this.#indexManager.addEventListener("changed", (e) =>
      this.#server.emit<IndexChangedUpdate>("index-changed", (e as CustomEvent<IndexChangedUpdate>).detail)
    );

    this.#recentItemsManager.addEventListener("changed", (e) => {
      this.#server.emit<RecentItemsChangedUpdate>("recent-items-changed", (e as CustomEvent<RecentItemsChangedUpdate>).detail);
    });
  }
}

new WorkerContainer().start();

export interface HandlerContext {
  server: WorkerServer;
  indexManager: IndexManager;
  recentContentManager: RecentItemsManager;
  db: Db;
}
