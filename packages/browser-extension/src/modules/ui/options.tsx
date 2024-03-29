import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkerClient } from "../ipc/client";
import { getCompleteConfig, normalizeAreaPath } from "../service/ado/config";
import { SyncContentRequest, SyncContentResponse, SyncContentUpdate } from "../service/handlers/handle-sync-content";
import { SyncMetadataRequest, SyncMetadataResponse, SyncMetadataUpdate } from "../service/handlers/handle-sync-metadata";
import { TestConnectionRequest, TestConnectionResponse } from "../service/handlers/handle-test-connection";
import { useHandleLinkClick } from "./hooks/use-event-handlers";

const worker = new Worker("./modules/service/worker.js");
const workerClient = new WorkerClient(worker);

interface OutputThread {
  name: string;
  message: string;
}

export const SetupForm: React.FC = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const areaPathInputRef = useRef<HTMLInputElement>(null);
  const [outputMessages, setOutputMessages] = useState<OutputThread[]>([]);
  const [isItemDataReady, setIsItemDataReady] = useState(false);
  const [isMetadataReady, setIsMetadataReady] = useState(false);

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

  const formatInput = useCallback(() => {
    if (areaPathInputRef.current!.value.length) {
      areaPathInputRef.current!.value = normalizeAreaPath(areaPathInputRef.current!.value);
    }

    [...formRef.current!.querySelectorAll("input")].forEach((input) => {
      input.value = input.value.trim();
    });
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

      const isFormValid = formRef.current?.checkValidity();
      if (!isFormValid) return;

      const isOnline = getNetworkStatus();
      if (!isOnline) return;

      const isConnectionValid = await getConnectionStatus();
      if (!isConnectionValid) return;

      manualSync();
    });
  }, []);

  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>(async (event) => {
    event.preventDefault();

    setIsItemDataReady(false);
    setIsMetadataReady(false);
    workerClient.unsubscribe("sync-progress", handleContentProgress);
    workerClient.unsubscribe("sync-metadata-progress", handleMetadataProgress);

    await clearOutput();
    formatInput();
    await saveForm();

    const isOnline = getNetworkStatus();
    if (!isOnline) return;

    await clearCache();

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
      printStatusMessage("connection-status", `⚠️ Connecting to Azure DevOps failed. Config is incomplete.`);
      return;
    }

    printStatusMessage("connection-status", `⌛ Connecting to Azure DevOps...`);
    const result = await workerClient.post<TestConnectionRequest, TestConnectionResponse>("test-connection", { config });
    if (result.status === "success") {
      printStatusMessage("connection-status", `✅ ${result.message}`);
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

    workerClient.subscribe<SyncContentUpdate>("sync-progress", handleContentProgress);
    workerClient.subscribe<SyncMetadataUpdate>("sync-metadata-progress", handleMetadataProgress);

    await Promise.all([
      workerClient.post<SyncContentRequest, SyncContentResponse>("sync-content", { config, rebuildIndex: true }),
      workerClient.post<SyncMetadataRequest, SyncMetadataResponse>("sync-metadata", { config }),
    ]);

    workerClient.unsubscribe("sync-progress", handleContentProgress);
    workerClient.unsubscribe("sync-metadata-progress", handleMetadataProgress);
  }, []);

  const handleContentProgress = useCallback((update: SyncContentUpdate) => {
    switch (update.type) {
      case "progress":
        printStatusMessage("sync", `⌛ ${update.message}`);
        break;
      case "success":
        printStatusMessage("sync", `✅ ${update.message}`);
        setIsItemDataReady(true);
        break;
      case "error":
        printStatusMessage("sync", `⚠️ ${update.message}`);
        break;
    }
  }, []);

  const handleMetadataProgress = useCallback((update: SyncMetadataUpdate) => {
    switch (update.type) {
      case "progress":
        printStatusMessage("sync-metadata", `⌛ ${update.message}`);
        break;
      case "success":
        printStatusMessage("sync-metadata", `✅ ${update.message}`);
        setIsMetadataReady(true);
        break;
      case "error":
        printStatusMessage("sync-metadata", `⚠️ ${update.message}`);
        break;
    }
  }, []);

  const handleLinkClick = useHandleLinkClick();

  return (
    <div className="setup-window">
      <h1>Setup</h1>
      <form className="setup-form" id="setup-form" onSubmit={handleSubmit} ref={formRef}>
        <section className="form-section">
          <div className="form-field">
            <label htmlFor="email">Work email</label>
            <input id="email" autoFocus autoComplete="email" name="email" spellCheck="false" type="email" placeholder="john@example.com" required />
          </div>

          <div className="form-field">
            <label htmlFor="org">Organization</label>
            <input id="org" name="org" type="text" spellCheck="false" placeholder="My organization" required />
            <div className="label-hint">
              *Can be found in the URL{" "}
              <samp>
                https://dev.azure.com/<em>&lt;MyOrganization&gt;</em>
              </samp>
              .{" "}
              <a href="https://dev.azure.com" target="_blank">
                Find my organization
              </a>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="area-path">Area path</label>
            <input id="area-path" ref={areaPathInputRef} name="areaPath" type="text" spellCheck="false" placeholder="My\Area\Path" required />
            <div className="label-hint">
              *Same as the <em>Area</em> field in work items. You can only query the 20,000 most recently changed items in the area.
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="pat">Personal access token</label>
            <input id="pat" name="pat" type="password" required />
            <div className="label-hint">
              *Must be created for the organization entered above, with <em>Read</em> permission on the <em>Work Items</em> scope.{" "}
              <a href="https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate" target="_blank">
                Get help
              </a>
            </div>
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
            {isItemDataReady && isMetadataReady && <div>🚀 The extension is ready to launch</div>}
          </output>
        </section>
      )}

      <section className="shortcuts-section">
        <h2>Shortcuts</h2>
        <p className="shortcuts-tip">
          *MacOS users should use <kbd className="key-name">⌘</kbd> instead of <kbd className="key-name">Ctrl</kbd>
        </p>
        <table className="shortcuts-table">
          <thead>
            <tr>
              <th>Command</th>
              <th>Shortcut</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Open/close extension</td>
              <td>
                Click on the <img className="launch-icon" src="./Logo.svg" height={19} /> button in the extension tray area
              </td>
            </tr>
            <tr>
              <td>Open/close extension with keyboard</td>
              <td>
                <kbd className="key-name">Alt</kbd> + <kbd className="key-name">A</kbd>, or customize at{" "}
                <a href="chrome://extensions/shortcuts" onClick={handleLinkClick}>
                  chrome://extensions/shortcuts
                </a>
              </td>
            </tr>
            <tr>
              <td>Select next item</td>
              <td>
                <kbd className="key-name">⇩</kbd> or <kbd className="key-name">Ctrl</kbd> + <kbd className="key-name">J</kbd>
              </td>
            </tr>
            <tr>
              <td>Select previous item</td>
              <td>
                <kbd className="key-name">⇧</kbd> or <kbd className="key-name">Ctrl</kbd> + <kbd className="key-name">K</kbd>
              </td>
            </tr>
            <tr>
              <td>Open selected item (current tab)</td>
              <td>
                <kbd className="key-name">Enter</kbd>
              </td>
            </tr>
            <tr>
              <td>Open selected item (new background tab)</td>
              <td>
                <kbd className="key-name">Ctrl</kbd> + <kbd className="key-name">Enter</kbd>
              </td>
            </tr>
            <tr>
              <td>Open selected item (new active tab)</td>
              <td>
                <kbd className="key-name">Ctrl</kbd> + <kbd className="key-name">Shift</kbd> + <kbd className="key-name">Enter</kbd>
              </td>
            </tr>
            <tr>
              <td>Open any item (current tab)</td>
              <td>Click on the Title</td>
            </tr>
            <tr>
              <td>Open any item (new background tab)</td>
              <td>
                <kbd className="key-name">Ctrl</kbd> + click on the Title
              </td>
            </tr>
            <tr>
              <td>Open any item (new active tab)</td>
              <td>
                <kbd className="key-name">Ctrl</kbd> + <kbd className="key-name">Shift</kbd> + click on the Title
              </td>
            </tr>
            <tr>
              <td>Select next field</td>
              <td>
                <kbd className="key-name">Tab</kbd> or <kbd className="key-name">Ctrl</kbd> + <kbd className="key-name">L</kbd>
              </td>
            </tr>
            <tr>
              <td>Select previous field</td>
              <td>
                <kbd className="key-name">Shift</kbd> + <kbd className="key-name">Tab</kbd> or <kbd className="key-name">Ctrl</kbd> +{" "}
                <kbd className="key-name">H</kbd>
              </td>
            </tr>
            <tr>
              <td>Select Title</td>
              <td>
                <kbd className="key-name">Alt</kbd> + click on the Title
              </td>
            </tr>
            <tr>
              <td>Select ID</td>
              <td>Click on the ID</td>
            </tr>
            <tr>
              <td>Select Type + ID + Title</td>
              <td>Click on the icon</td>
            </tr>
            <tr>
              <td>Copy selected Title or field(s)</td>
              <td>
                <kbd className="key-name">Ctrl</kbd> + <kbd className="key-name">C</kbd>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="syntax-section">
        <h2>Query syntax</h2>
        <p className="shortcuts-tip">*To require a phrase, surround it with double quotes ("")</p>
        <p className="shortcuts-tip">**To require a case-sensitive phrase, use at least one uppercase letter</p>
        <table className="shortcuts-table">
          <thead>
            <tr>
              <th>Example</th>
              <th>Explanation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="u-no-wrap">Hello world</td>
              <td>Fuzzy search for "hello" and "world"</td>
            </tr>
            <tr>
              <td className="u-no-wrap">Hello "world"</td>
              <td>Fuzzy search for "hello" and require the phrase "world" (case-insensitive)</td>
            </tr>
            <tr>
              <td className="u-no-wrap">Hello "World"</td>
              <td>Fuzzy match for "hello" and required the phrase "World" (case-sensitive)</td>
            </tr>
            <tr>
              <td className="u-no-wrap">"hello" "WORLD"</td>
              <td>Require both "hello" (case-insensitive) and "WORLD" (case-sensitive)</td>
            </tr>
            <tr>
              <td className="u-no-wrap">"hello world"</td>
              <td>Require the phrase "hello world" (case-insensitive)</td>
            </tr>
            <tr>
              <td className="u-no-wrap">"Hello world"</td>
              <td>Require the phrase "Hello world" (case-sensitive)</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section className="info-section">
        <a href="https://github.com/chuanqisun/turbo-query">Open source</a> | <a href="https://github.com/chuanqisun/turbo-query/releases">Release notes</a> |{" "}
        <a href="https://github.com/chuanqisun/turbo-query/issues/new">File an issue</a>
      </section>
    </div>
  );
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SetupForm />
  </React.StrictMode>
);
