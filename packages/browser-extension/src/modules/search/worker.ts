import { WorkerServer } from "../ipc/server";

const server = new WorkerServer(self as any as Worker);
