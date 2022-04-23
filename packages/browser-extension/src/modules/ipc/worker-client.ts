export class WorkerClient {
  #worker: Worker;
  #connectionHandles = new Map<number, any>();
  #connectionId = 0;

  constructor(worker: Worker) {
    this.#worker = worker;
    this.#start();
  }

  #start() {
    this.#worker.addEventListener("message", (ev) => {
      const [id, route, response] = ev.data;
      const resolver = this.#connectionHandles.get(id);
      if (!resolver) {
        throw new Error(`[worker-proxy] has no resolver found for response id ${id}: ${JSON.stringify(response)}`);
      }

      resolver(response);
      this.#connectionHandles.delete(id);
      console.log(`[worker-client] #${id}|${route}|${performance.measure(`request ${id} duration`, `req-${id}`).duration.toFixed(2)}ms`);
    });

    console.log(`[worker-proxy] worker proxy started`);
  }

  post<RequestType, ReturnType>(route: string, request: RequestType): Promise<ReturnType> {
    return new Promise((resolver) => {
      const id = ++this.#connectionId;
      performance.mark(`req-${id}`);

      this.#connectionHandles.set(id, resolver);
      this.#worker.postMessage([id, route, request]);
    });
  }
}
