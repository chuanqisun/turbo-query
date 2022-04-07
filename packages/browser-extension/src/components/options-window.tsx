import React, { useCallback, useEffect, useRef } from "react";

export const OptionsWindow = () => {
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>((event) => {
    event.preventDefault();
    const formData = new FormData(formRef.current!);
    const configDict = Object.fromEntries(formData.entries());
    console.log(configDict);
    chrome.storage.sync.set(configDict);
  }, []);

  useEffect(() => {
    const formData = new FormData(formRef.current!);
    console.log(...formData.keys());
    chrome.storage.sync.get([...formData.keys()]).then((configDict) => {
      console.log({ ...configDict });
      Object.entries(configDict).forEach(([key, value]) => (formRef.current!.querySelector<HTMLInputElement>(`[name="${key}"]`)!.value = value));
    });
  }, []);

  return (
    <form onSubmit={handleSubmit} ref={formRef}>
      <fieldset>
        <legend>Data source</legend>

        <div className="form-field">
          <label>Organization</label>
          <input name="org" type="text" required />
        </div>

        <div className="form-field">
          <label>Project</label>
          <input name="project" type="text" required />
        </div>

        <div className="form-field">
          <label>Team</label>
          <input name="team" type="text" required />
        </div>

        <div className="form-field">
          <label>Root query id</label>
          <input name="rootQueryId" type="text" required />
        </div>

        <div className="form-field">
          <label>Trash bin query id</label>
          <input name="trashQueryId" type="text" required />
        </div>
      </fieldset>

      <fieldset>
        <legend>Account</legend>

        <div className="form-field">
          <label>Work email</label>
          <input name="email" type="email" required />
        </div>

        <div className="form-field">
          <label>Personal access token</label>
          <input name="pat" type="password" required />
        </div>
      </fieldset>

      <button>Save</button>
    </form>
  );
};
