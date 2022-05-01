import { ApiProxy, Config } from "../ado/api-proxy";
import { HandlerContext } from "../worker";

export interface SyncMetadataRequest {
  config: Config;
}

export interface SyncMetadataResponse {
  itemTypeCount: number;
  fetchCount: number;
}

export interface SyncMetadataUpdate {
  type: "progress" | "error" | "success";
  message: string;
}

export async function handleSyncMetadata({ server, metadataManager }: HandlerContext, request: SyncMetadataRequest): Promise<SyncMetadataResponse> {
  const api = new ApiProxy(request.config);

  try {
    server.emit<SyncMetadataUpdate>("sync-metadata-progress", { type: "progress", message: "Fetching metadata..." });
    const itemTypes = await api.getWorkItemTypes();

    server.emit<SyncMetadataUpdate>("sync-metadata-progress", { type: "progress", message: "Fetching icons..." });
    const summary = await metadataManager.updateMetadataDictionary(itemTypes, (update) =>
      server.emit<SyncMetadataUpdate>("sync-metadata-progress", {
        type: "progress",
        message: `Fetching icons... ${((update.progress / update.total) * 100).toFixed(2)}%`,
      })
    );

    server.emit<SyncMetadataUpdate>("sync-metadata-progress", {
      type: "success",
      message: `Sync metadata... Success! (${summary.itemTypeCount} types, ${summary.fetchCount} new icons)`,
    });

    return summary;
  } catch (error: any) {
    server.emit<SyncMetadataUpdate>("sync-metadata-progress", { type: "error", message: error?.message ?? "Unknown error" });

    return {
      itemTypeCount: 0,
      fetchCount: 0,
    };
  }
}
