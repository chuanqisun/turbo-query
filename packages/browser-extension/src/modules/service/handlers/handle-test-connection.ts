import { ApiProxy, Config } from "../ado/api-proxy";
import { HandlerContext } from "../worker";

export interface TestConnectionRequest {
  config: Config;
}

export interface TestConnectionResponse {
  status: "success" | "error";
  message: string;
}

export async function handleTestConnection(_ctx: HandlerContext, request: TestConnectionRequest): Promise<TestConnectionResponse> {
  const api = new ApiProxy(request.config);
  try {
    const ids = await api.getAllWorkItemIds();
    return {
      status: "success",
      message: `Connection success! ${ids.length} items found.`,
    };
  } catch (e) {
    return {
      status: "error",
      message: `Connection failed! ${(e as any)?.message ?? "Unknown error"}`,
    };
  }
}