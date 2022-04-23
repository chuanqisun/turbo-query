import { WorkerServer } from "../ipc/worker-server";

const server = new WorkerServer(self as any as Worker);

server.addRequestHandler("heartbeat", async (req: number) => {
  return req + 1;
});
