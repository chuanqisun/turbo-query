import { ApiProxy, Config } from "../utils/ado/api-proxy";
import { WorkerServer } from "../utils/ipc/server";
import { sync } from "../utils/sync/sync";

class SyncWorker {
  #server = new WorkerServer(self as any as Worker);
  #api: ApiProxy | null = null;

  async start() {
    this.#server.addRequestHandler("config", this.handleConfig.bind(this));
    this.#server.addRequestHandler("sync", this.handleSync.bind(this));
  }

  async handleConfig(config: Config) {
    this.#api = new ApiProxy(config);
  }

  async handleSync() {
    if (!this.#api) throw new Error("ApiProxy not initialized");

    await sync(this.#api, {
      onIdProgress: (message) => console.log(`⌛ ${message}`),
      onItemInitProgress: (message) => console.log(`⌛ ${message}`),
      onSyncSuccess: (message) => console.log(`✅ ${message}`),
      onError: (message) => console.log(`⚠️ ${message}`),
    });
  }
}

new SyncWorker().start();
