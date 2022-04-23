import { WorkerServer } from "../utils/ipc/server";
import { handleReset } from "./handlers/handle-reset";
import { handleSync } from "./handlers/handle-sync";
import { handleTestConnection } from "./handlers/handle-test-connection";

class SyncWorker {
  #server = new WorkerServer(self as any as Worker);

  async start() {
    this.#server.addRequestHandler("sync", handleSync.bind(null, this.#server));
    this.#server.addRequestHandler("reset", handleReset.bind(null, this.#server));
    this.#server.addRequestHandler("test-connection", handleTestConnection.bind(null, this.#server));
  }
}

new SyncWorker().start();
