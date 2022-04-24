import { WorkerServer } from "../ipc/server";
import { handleBuildIndex } from "./handlers/handle-build-index";
import { handleImportIndex } from "./handlers/handle-import-index";
import { handleSearch } from "./handlers/handle-search";

class SearchWorker {
  #server = new WorkerServer(self as any as Worker);

  async start() {
    // TODO: push index update events to clients
    // TODO: store and track active index, consider using OOP
    this.#server.addRequestHandler("import-index", handleImportIndex.bind(null, this.#server));
    this.#server.addRequestHandler("build-index", handleBuildIndex.bind(null, this.#server));

    this.#server.addRequestHandler("search", handleSearch.bind(null, this.#server));
  }
}

new SearchWorker().start();
