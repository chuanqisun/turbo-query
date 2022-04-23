import { WorkerServer } from "../utils/ipc/server";

const server = new WorkerServer(self as any as Worker);
