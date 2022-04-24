import { WorkerServer } from "../ipc/server";
import { handleBuildIndex } from "./handlers/handle-build-index";
import { handleImportIndex } from "./handlers/handle-import-index";
import { handleReset } from "./handlers/handle-reset";
import { handleSearch } from "./handlers/handle-search";
import { handleSync } from "./handlers/handle-sync";
import { handleTestConnection } from "./handlers/handle-test-connection";

class SyncWorker {
  #server = new WorkerServer(self as any as Worker);

  async start() {
    this.#server.addRequestHandler("sync", handleSync.bind(null, this.#server));
    this.#server.addRequestHandler("reset", handleReset.bind(null, this.#server));
    this.#server.addRequestHandler("test-connection", handleTestConnection.bind(null, this.#server));

    // TODO: push index update events to clients
    // TODO: store and track active index, consider using OOP
    this.#server.addRequestHandler("import-index", handleImportIndex.bind(null, this.#server));
    this.#server.addRequestHandler("build-index", handleBuildIndex.bind(null, this.#server));

    this.#server.addRequestHandler("search", handleSearch.bind(null, this.#server));
  }
}

new SyncWorker().start();
