import React, { useCallback, useEffect, useRef, useState } from "react";
import { db } from "./data/db";
import "./setup-form.css";
import { getAllWorkItemIds } from "./utils/proxy";

export const SetupForm: React.FC = () => {
  const formRef = useRef<HTMLFormElement | null>(null);

  const [statusMessage, setStatusMessage] = useState("");

  const saveForm = useCallback(async () => {
    const formData = new FormData(formRef.current!);
    const configDict = Object.fromEntries(formData.entries());
    await chrome.storage.sync.set(configDict);
  }, []);

  // init form
  useEffect(() => {
    const formData = new FormData(formRef.current!);
    console.log(...formData.keys());
    chrome.storage.sync.get([...formData.keys()]).then((configDict) => {
      console.log({ ...configDict });
      Object.entries(configDict).forEach(([key, value]) => (formRef.current!.querySelector<HTMLInputElement>(`[name="${key}"]`)!.value = value));

      const isValid = formRef.current?.checkValidity();
      if (isValid) {
        checkStatus();
      }
    });
  }, []);

  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>((event) => {
    event.preventDefault();
    saveForm().then(() => {
      checkStatus();
    });
  }, []);

  const checkStatus = useCallback(() => {
    setStatusMessage(`⌛ Connecting...`);
    getAllWorkItemIds()
      .then((result) => {
        setStatusMessage(`✅ Connecting... Success! ${result.length} work items found.`);
      })
      .catch((error) => {
        setStatusMessage(`⚠️ Connecting... Failed. ${error?.message}`);
      });
  }, []);

  const resetDb = useCallback(() => {
    db.delete().then();
    setStatusMessage(`✅ Database reset... Success!`);
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
            <input id="org" name="org" type="text" required />
          </div>

          <div className="form-field">
            <label htmlFor="project">Project</label>
            <input id="project" name="project" type="text" required />
          </div>

          <div className="form-field">
            <label htmlFor="team">Team</label>
            <input id="team" name="team" type="text" required />
          </div>

          <div className="form-field">
            <label htmlFor="area-path">Area path</label>
            <input id="area-path" name="areaPath" type="text" required />
          </div>
        </section>
      </form>
      <section className="form-actions">
        <button type="submit" form="setup-form">
          Save and connect
        </button>
        <button onClick={resetDb}>Reset database</button>
      </section>

      {statusMessage.length > 0 && (
        <section className="form-section">
          <output className="status-output">{statusMessage}</output>
        </section>
      )}
    </div>
  );
};
