import { ApiProxy, Config } from "../ado/api-proxy";
import { HandlerContext } from "../worker";

export interface SyncMetadataRequest {
  config: Config;
  clear?: boolean;
}

export interface SyncMetadataResponse {
  // TBD
}

export interface SyncMetadataUpdate {
  type: "progress" | "error" | "success";
  message: string;
}

export async function handleSyncMetadata({ server, metadataManager }: HandlerContext, request: SyncMetadataRequest): Promise<void> {
  const api = new ApiProxy(request.config);

  try {
    server.emit<SyncMetadataUpdate>("sync-metadata-progress", { type: "progress", message: "Fetching metadata..." });
    const itemTypes = await api.getWorkItemTypes();
    server.emit<SyncMetadataUpdate>("sync-metadata-progress", { type: "progress", message: "Fetching icons..." });

    await metadataManager.updateMetadataDictionary(itemTypes);

    server.emit<SyncMetadataUpdate>("sync-metadata-progress", { type: "success", message: "Sync metadata... Success!" });
  } catch (error: any) {
    server.emit<SyncMetadataUpdate>("sync-metadata-progress", { type: "error", message: error?.message ?? "Unknown error" });
  }
}
