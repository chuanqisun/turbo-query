import type { RequestData, ResponseData, UpdateData } from "./server";

export class WorkerClient {
  #worker: Worker;
  #connectionHandles = new Map<number, Resolver>();
  #observers = new Map<string, Observer[]>();
  #connectionId = 0;

  constructor(worker: Worker) {
    this.#worker = worker;
    this.#start();
  }

  #start() {
    this.#worker.addEventListener("message", (ev: MessageEvent<ResponseData | UpdateData>) => {
      const [id, route, response] = ev.data;

      if (id !== null) {
        // one-off messages
        const resolver = this.#connectionHandles.get(id);
        resolver?.(response);
        this.#connectionHandles.delete(id);
        console.log(`[worker-client] #${id}:${route}:${performance.measure(`request ${id} duration`, `req-${id}`).duration.toFixed(2)}ms`);
      } else {
        // subscriptions
        const observers = this.#observers.get(route) ?? [];
        observers.forEach((observer) => observer(response));
        console.log(`[worker-client] #sub:${route}:${observers.length} notified`);
      }
    });

    console.log(`[worker-client] worker client started`);
  }

  subscribe<UpdateType>(route: string, observer: Observer<UpdateType>) {
    const observers = this.#observers.get(route) ?? [];
    observers.push(observer);
    this.#observers.set(route, observers);
  }

  unsubscribe(route: string, observer: Observer) {
    const observers = this.#observers.get(route) ?? [];
    const remainingObservers = observers.filter((o) => o !== observer);
    if (remainingObservers.length) {
      this.#observers.set(route, remainingObservers);
    } else {
      this.#observers.delete(route);
    }
  }

  post<RequestType, ResponseType>(route: string, request: RequestType): Promise<ResponseType> {
    return new Promise((resolver) => {
      const id = ++this.#connectionId;
      performance.mark(`req-${id}`);
      this.#connectionHandles.set(id, resolver);

      const message: RequestData<RequestType> = [id, route, request];
      this.#worker.postMessage(message);
    });
  }
}

export type Observer<UpdateType = any> = (update: UpdateType) => any;
type Resolver = (value: any) => any;
