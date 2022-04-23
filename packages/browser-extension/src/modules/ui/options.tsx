import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { WorkerClient } from "../ipc/client";
import { getCompleteConfig } from "../sync/ado/config";
import { SyncProgressUpdate, SyncRequest, SyncResponse } from "../sync/handlers/handle-sync";
import { TestConnectionRequest, TestConnectionResponse } from "../sync/handlers/handle-test-connection";

const syncWorker = new Worker("./modules/sync/worker.js");
const syncClient = new WorkerClient(syncWorker);

export const SetupForm: React.FC = () => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const workerClientRef = useRef<WorkerClient>(syncClient);

  useEffect(() => {}, []);

  const [statusMessage, setStatusMessage] = useState("");

  const saveForm = useCallback(async () => {
    const formData = new FormData(formRef.current!);
    const configDict = Object.fromEntries(formData.entries());
    await chrome.storage.sync.set(configDict);
  }, []);

  // init form
  useEffect(() => {
    const formData = new FormData(formRef.current!);
    chrome.storage.sync.get([...formData.keys()]).then((configDict) => {
      console.log(`[options]`, { ...configDict });
      Object.entries(configDict).forEach(([key, value]) => (formRef.current!.querySelector<HTMLInputElement>(`[name="${key}"]`)!.value = value));

      const isValid = formRef.current?.checkValidity();
      if (isValid) {
        checkStatus();
      }
    });
  }, []);

  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>(async (event) => {
    event.preventDefault();
    await clearCache();
    await saveForm();

    checkStatus();
  }, []);

  const checkStatus = useCallback(async () => {
    const config = await getCompleteConfig();
    if (!config) {
      setStatusMessage(`⚠️ Connection failed! Missing config.`);
      return;
    }

    setStatusMessage(`⌛ Connecting...`);
    const result = await workerClientRef.current.post<TestConnectionRequest, TestConnectionResponse>("test-connection", { config });
    if (result.status === "success") {
      await manualSync();
    } else {
      setStatusMessage(`⚠️ ${result.message}`);
    }
  }, []);

  const clearCache = useCallback(async () => {
    await workerClientRef.current.post("reset", {});
    setStatusMessage(`✅ Clearing cache... Success!`);
  }, []);

  const manualSync = useCallback(async () => {
    const config = await getCompleteConfig();
    if (!config) return;

    function syncProgressObserver(update: SyncProgressUpdate) {
      switch (update.type) {
        case "progress":
          setStatusMessage(`⌛ ${update.message}`);
          break;
        case "success":
          setStatusMessage(`✅ ${update.message}`);
          break;
        case "error":
          setStatusMessage(`⚠️ ${update.message}`);
          break;
      }
    }

    workerClientRef.current.subscribe<SyncProgressUpdate>("sync-progress", syncProgressObserver);
    await workerClientRef.current.post<SyncRequest, SyncResponse>("sync", { config });
    workerClientRef.current.unsubscribe("sync-progress", syncProgressObserver);
  }, []);

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
        <details>
          <summary>Advanced actions</summary>
          <div className="advanced-actions">
            <button onClick={clearCache}>Clear cache</button>
            <button onClick={manualSync}>Manual sync</button>
          </div>
        </details>
      </section>

      {statusMessage.length > 0 && (
        <section className="form-section">
          <output className="status-output">{statusMessage}</output>
        </section>
      )}
    </div>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <SetupForm />
  </React.StrictMode>,
  document.getElementById("root")
);
