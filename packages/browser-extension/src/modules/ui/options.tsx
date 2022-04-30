import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { WorkerClient } from "../ipc/client";
import { getCompleteConfig } from "../service/ado/config";
import { SyncProgressUpdate, SyncRequest, SyncResponse } from "../service/handlers/handle-sync";
import { SyncMetadataRequest, SyncMetadataResponse, SyncMetadataUpdate } from "../service/handlers/handle-sync-metadata";
import { TestConnectionRequest, TestConnectionResponse } from "../service/handlers/handle-test-connection";
import { useHandleLinkClick } from "./components/hooks/use-event-handlers";

const worker = new Worker("./modules/service/worker.js");
const workerClient = new WorkerClient(worker);

interface OutputThread {
  name: string;
  message: string;
}

export const SetupForm: React.FC = () => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [outputMessages, setOutputMessages] = useState<OutputThread[]>([]);

  const printStatusMessage = useCallback((threadName: string, message: string) => {
    setOutputMessages((previousMessages) => {
      const matchedIndex = previousMessages.findIndex((m) => m.name === threadName);
      if (matchedIndex < 0) {
        return [...previousMessages, { name: threadName, message }];
      } else {
        const mutableMessages = [...previousMessages];
        mutableMessages.splice(matchedIndex, 1, { name: threadName, message });
        return mutableMessages;
      }
    });
  }, []);

  const clearOutput = useCallback(() => {
    setOutputMessages([]);
  }, []);

  const saveForm = useCallback(async () => {
    const formData = new FormData(formRef.current!);
    const configDict = Object.fromEntries(formData.entries());
    await chrome.storage.sync.set(configDict);
  }, []);

  // init form
  useEffect(() => {
    const formData = new FormData(formRef.current!);
    chrome.storage.sync.get([...formData.keys()]).then(async (configDict) => {
      console.log(`[options]`, { ...configDict });
      Object.entries(configDict).forEach(([key, value]) => (formRef.current!.querySelector<HTMLInputElement>(`[name="${key}"]`)!.value = value));

      const isOnline = getNetworkStatus();
      if (!isOnline) return;

      const isFormValid = formRef.current?.checkValidity();
      if (!isFormValid) return;

      const isConnectionValid = await getConnectionStatus();
      if (!isConnectionValid) return;

      manualSync();
    });
  }, []);

  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>(async (event) => {
    event.preventDefault();

    const isOnline = getNetworkStatus();
    if (!isOnline) return;

    await clearOutput();

    await clearCache();
    await saveForm();

    const isValidStatus = await getConnectionStatus();
    if (isValidStatus) {
      manualSync();
    }
  }, []);

  const getNetworkStatus = useCallback(() => {
    if (!navigator.onLine) {
      printStatusMessage("network-status", `⚠️ Network is offline`);
      return false;
    }
    printStatusMessage("network-status", `✅ Network is online`);
    return true;
  }, []);

  const getConnectionStatus = useCallback(async () => {
    const config = await getCompleteConfig();
    if (!config) {
      printStatusMessage("connection-status", `⚠️ Connection failed. Config is incomplete.`);
      return;
    }

    printStatusMessage("connection-status", `⌛ Connecting...`);
    const result = await workerClient.post<TestConnectionRequest, TestConnectionResponse>("test-connection", { config });
    if (result.status === "success") {
      printStatusMessage("connection-status", `✅ Connecting... Success!`);
      return true;
    } else {
      printStatusMessage("connection-status", `⚠️ ${result.message}`);
      return false;
    }
  }, []);

  const clearCache = useCallback(async () => {
    await workerClient.post("reset", {});
    printStatusMessage("reset", `✅ Clearing cache... Success!`);
  }, []);

  const manualSync = useCallback(async () => {
    const config = await getCompleteConfig();
    if (!config) return;

    function syncProgressObserver(update: SyncProgressUpdate) {
      switch (update.type) {
        case "progress":
          printStatusMessage("sync", `⌛ ${update.message}`);
          break;
        case "success":
          printStatusMessage("sync", `✅ ${update.message}`);
          break;
        case "error":
          printStatusMessage("sync", `⚠️ ${update.message}`);
          break;
      }
    }

    function syncMeatadataProgressObserver(update: SyncMetadataUpdate) {
      switch (update.type) {
        case "progress":
          printStatusMessage("sync-metadata", `⌛ ${update.message}`);
          break;
        case "success":
          printStatusMessage("sync-metadata", `✅ ${update.message}`);
          break;
        case "error":
          printStatusMessage("sync-metadata", `⚠️ ${update.message}`);
          break;
      }
    }

    workerClient.subscribe<SyncProgressUpdate>("sync-progress", syncProgressObserver);
    workerClient.subscribe<SyncMetadataUpdate>("sync-metadata-progress", syncMeatadataProgressObserver);

    await Promise.all([
      workerClient.post<SyncRequest, SyncResponse>("sync", { config, rebuildIndex: true }),
      workerClient.post<SyncMetadataRequest, SyncMetadataResponse>("sync-metadata", { config, clear: true }),
    ]);

    workerClient.unsubscribe("sync-progress", syncProgressObserver);
    workerClient.unsubscribe("sync-metadata-progress", syncMeatadataProgressObserver);
  }, []);

  const handleLinkClick = useHandleLinkClick();

  return (
    <div className="setup-window">
      <h1>Setup</h1>
      <form className="setup-form" id="setup-form" onSubmit={handleSubmit} ref={formRef}>
        <section className="form-section">
          <div className="form-field">
            <label htmlFor="email">Work email</label>
            <input id="email" autoFocus name="email" type="email" placeholder="john@example.com" required />
          </div>
          <div className="form-field">
            <label htmlFor="pat">Personal access token</label>
            <input id="pat" name="pat" type="password" required />
            <div className="label-hint">
              *Requires <em>Read</em> permission on the <em>Work Items</em> scope.{" "}
              <a href="https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate">Get help</a>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="org">Organization</label>
            <input id="org" name="org" type="text" placeholder="My organization" required />
          </div>

          <div className="form-field">
            <label htmlFor="project">Project</label>
            <input id="project" name="project" type="text" placeholder="My project" required />
          </div>

          <div className="form-field">
            <label htmlFor="area-path">Area path</label>
            <input id="area-path" name="areaPath" type="text" placeholder="My\Area\Path" required />
          </div>
        </section>
      </form>

      <section className="form-actions">
        <button type="submit" form="setup-form">
          Save and connect
        </button>
      </section>

      {outputMessages.length > 0 && (
        <section className="form-section">
          <output className="status-output">
            {outputMessages.map((message) => (
              <div key={message.name}>{message.message}</div>
            ))}
          </output>
        </section>
      )}

      <section className="shortcuts-section">
        <h2>Shortcuts</h2>
        <table className="shortcuts-table">
          <tbody>
            <tr>
              <td>Open popup</td>
              <td>
                <kbd className="key-name">Alt</kbd> + <kbd className="key-name">A</kbd>, or customize at{" "}
                <a href="chrome://extensions/shortcuts" onClick={handleLinkClick}>
                  chrome://extensions/shortcuts
                </a>
              </td>
            </tr>
            <tr>
              <td>Copy item ID + title</td>
              <td>
                Click on item icon, then <kbd className="key-name">Ctrl</kbd> + <kbd className="key-name">C</kbd> or <kbd className="key-name">⌘</kbd> +{" "}
                <kbd className="key-name">C</kbd>
              </td>
            </tr>
            <tr>
              <td>Copy item ID</td>
              <td>
                Click on item ID, then <kbd className="key-name">Ctrl</kbd> + <kbd className="key-name">C</kbd> or <kbd className="key-name">⌘</kbd> +{" "}
                <kbd className="key-name">C</kbd>
              </td>
            </tr>
            <tr>
              <td>Open in current tab</td>
              <td>Click on item title</td>
            </tr>
            <tr>
              <td>Open in new tab</td>
              <td>
                <kbd className="key-name">Ctrl</kbd> + click or <kbd className="key-name">⌘</kbd> + click on item title
              </td>
            </tr>
            <tr>
              <td>Open in new tab and navigate to it</td>
              <td>
                <kbd className="key-name">Ctrl</kbd> + <kbd className="key-name">Shift</kbd> + click or <kbd className="key-name">⌘</kbd> +{" "}
                <kbd className="key-name">Shift</kbd> + click on item title
              </td>
            </tr>
            <tr>
              <td>Select title</td>
              <td>
                <kbd className="key-name">Alt</kbd> + click on the title
              </td>
            </tr>
            <tr>
              <td>Select tag</td>
              <td>Click on tag</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <SetupForm />
  </React.StrictMode>,
  document.getElementById("root")
);
