import { useCallback, useEffect, useState } from "react";
import { WorkerClient } from "../../../ipc/client";
import { Config } from "../../../service/ado/api-proxy";
import { SyncContentRequest, SyncContentResponse, SyncContentUpdate } from "../../../service/handlers/handle-sync-content";
import { SyncMetadataRequest, SyncMetadataResponse, SyncMetadataUpdate } from "../../../service/handlers/handle-sync-metadata";
import { useIsOffline } from "./use-is-offline";
import { useRecursiveTimer } from "./use-recursive-timer";

const POLLING_INTERVAL = 10;

export interface UseSyncProps {
  config?: Config;
  setMessage: (message: string) => any;
  workerClient: WorkerClient;
}
export function useSync({ config, setMessage, workerClient }: UseSyncProps) {
  const [errors, setErrors] = useState<string[]>([]);
  const isOffline = useIsOffline();

  useEffect(() => {
    setMessage(isOffline ? "System offline" : "System online");
  }, [isOffline]);

  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);
  const requestSync = useCallback(async () => {
    if (!config) return;
    if (!navigator.onLine) return;

    let initialSyncPendingTasks = 2;

    if (!isInitialSyncDone) {
      function onInitialSyncTaskSuccess() {
        initialSyncPendingTasks--;
        if (initialSyncPendingTasks === 0) {
          setIsInitialSyncDone(true);
          setErrors([]);
        }
      }

      function contentProgressObserver(update: SyncContentUpdate) {
        switch (update.type) {
          case "progress":
            if (errors.length) return; // don't override existing errors
            setMessage(update.message);
            break;
          case "success":
            setMessage(update.message);
            onInitialSyncTaskSuccess();
            break;
          case "error":
            setMessage(update.message);
            setErrors((prev) => [...prev, `Sync content failed: ${update.message}`]);
            break;
        }
      }

      function metadataProgressObserver(update: SyncMetadataUpdate) {
        switch (update.type) {
          case "progress":
            if (errors.length) return; // don't override existing errors
            setMessage(update.message);
            break;
          case "success":
            setMessage(update.message);
            onInitialSyncTaskSuccess();
            break;
          case "error":
            setMessage(update.message);
            setErrors((prev) => [...prev, `Sync metadata failed: ${update.message}`]);
            break;
        }
      }
      workerClient.subscribe<SyncContentUpdate>("sync-progress", contentProgressObserver);
      workerClient.subscribe<SyncMetadataUpdate>("sync-metadata-progress", metadataProgressObserver);

      // full sync
      await Promise.all([
        workerClient.post<SyncContentRequest, SyncContentResponse>("sync-content", { config, rebuildIndex: true }),
        workerClient.post<SyncMetadataRequest, SyncMetadataResponse>("sync-metadata", { config }),
      ]);

      workerClient.unsubscribe("sync-progress", contentProgressObserver);
      workerClient.unsubscribe("sync-metadata-progress", metadataProgressObserver);
    } else {
      // incremental sync
      function contentProgressObserver(update: SyncContentUpdate) {
        switch (update.type) {
          case "success":
            setMessage(update.message);
            break;
          case "error":
            setMessage(update.message);
            break;
        }
      }
      workerClient.subscribe<SyncContentUpdate>("sync-progress", contentProgressObserver);

      await workerClient.post<SyncContentRequest, SyncContentResponse>("sync-content", { config });

      workerClient.unsubscribe("sync-progress", contentProgressObserver);
    }
  }, [config, isInitialSyncDone, errors]);

  // polling sync
  useRecursiveTimer(requestSync, isOffline || !config ? null : POLLING_INTERVAL * 1000);
  useEffect(() => {
    if (!config) return;

    requestSync();
  }, [config]);

  return {
    errors,
  };
}
