import { WorkerServer } from "../ipc/worker-server";

const server = new WorkerServer(self as any as Worker);

server.addRequestHandler("ping", async (req: number) => {
  return req + 1;
});

setInterval(() => {
  server.push("heartbeat", Date.now());
}, 3000);
