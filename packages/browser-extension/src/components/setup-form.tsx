import React, { useCallback, useEffect, useRef, useState } from "react";
import { db } from "./data/db";
import "./setup-form.css";
import { getAllWorkItemIds } from "./utils/proxy";

export const SetupForm: React.FC = () => {
  const formRef = useRef<HTMLFormElement | null>(null);

  const [statusMessage, setStatusMessage] = useState<null | string>(null);

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
      if (isValid) checkStatus();
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
        setStatusMessage(`✅ Connecting... Success! ${result.length} work items founds.`);
      })
      .catch((error) => {
        setStatusMessage(`⚠️ Connecting... Failed. ${error?.message}`);
      });
  }, []);

  const resetDb = useCallback(() => {
    db.delete().then(() => location.reload());
  }, []);

  return (
    <form className="setup-form" onSubmit={handleSubmit} ref={formRef}>
      <section className="form-section">
        <div className="form-field">
          <label>Work email</label>
          <input name="email" type="email" required />
        </div>
        <div className="form-field">
          <label>Personal access token</label>
          <input name="pat" type="password" required />
        </div>
      </section>

      <section className="form-section">
        <div className="form-field">
          <label>Organization</label>
          <input name="org" type="text" required />
        </div>

        <div className="form-field">
          <label htmlFor="project">Project</label>
          <input name="project" type="text" required />
        </div>

        <div className="form-field">
          <label>Team</label>
          <input name="team" type="text" required />
        </div>

        <div className="form-field">
          <label>Area path</label>
          <input name="areaPath" type="text" required />
        </div>

        <button type="submit">Update settings</button>
      </section>

      <section className="form-section">
        <output>{statusMessage}</output>
      </section>

      <details>
        <summary>More options</summary>
        <button type="button" onClick={resetDb}>
          Reset DB
        </button>
      </details>
    </form>
  );
};
