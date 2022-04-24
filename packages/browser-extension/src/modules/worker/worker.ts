import { WorkerServer } from "../ipc/server";
import { handleReset } from "./handlers/handle-reset";
import { handleSearch } from "./handlers/handle-search";
import { handleSync } from "./handlers/handle-sync";
import { handleTestConnection } from "./handlers/handle-test-connection";
import { IndexManager } from "./utils/index-manager";

class WorkerContainer {
  #server = new WorkerServer(self as any as Worker);
  #indexManager = new IndexManager();

  async start() {
    const handlerContext: HandlerContext = {
      server: this.#server,
      indexManager: this.#indexManager,
    };

    this.#server.addRequestHandler("sync", handleSync.bind(null, handlerContext));
    this.#server.addRequestHandler("reset", handleReset.bind(null, handlerContext));
    this.#server.addRequestHandler("test-connection", handleTestConnection.bind(null, handlerContext));

    this.#server.addRequestHandler("search", handleSearch.bind(null, handlerContext));

    this.#indexManager.addEventListener("changed", (e) => this.#server.push("index-changed", null));
  }
}

new WorkerContainer().start();

export interface HandlerContext {
  server: WorkerServer;
  indexManager: IndexManager;
}
