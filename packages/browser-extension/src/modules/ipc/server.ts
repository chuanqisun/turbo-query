export class WorkerServer {
  #worker: Worker;
  #handlers = new Map<string, Handler>();

  constructor(worker: Worker) {
    this.#worker = worker;
    this.#start();
  }

  #start() {
    this.#worker.addEventListener("message", async (ev: MessageEvent<RequestData>) => {
      const [id, route, request] = ev.data;
      const handler = this.#handlers.get(route);
      if (!handler) throw new Error(`Unhandled route ${route}`);
      performance.mark(`req-${id}`);
      const response = await handler(request);
      console.log(`[worker-server] #${id}:${route}:${performance.measure(`request ${id} duration`, `req-${id}`).duration.toFixed(2)}ms`);
      this.#worker.postMessage([id, route, response]);
    });
  }

  addRequestHandler<RequestType, ResponseType>(route: string, handler: Handler<RequestType, ResponseType>) {
    this.#handlers.set(route, handler);
  }

  push<UpdateType>(route: string, update: UpdateType) {
    const message: UpdateData<UpdateType> = [null, route, update];
    this.#worker.postMessage(message);
  }
}

export type RequestData<RequestType = any> = [id: number, route: string, request: RequestType];
export type ResponseData<ResponseType = any> = [id: number, route: string, response: ResponseType];
export type UpdateData<UpdateType = any> = [id: null, route: string, update: UpdateType];

export type Handler<RequestType = any, ResponseType = any> = (request: RequestType) => Promise<ResponseType>;
