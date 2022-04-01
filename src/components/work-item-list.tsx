import React, { useEffect } from "react";

const env = import.meta.env as any;

export const WorkItemList = () => {
  useEffect(() => {
    const creds = `${env.VITE_USER_EMAIL}:${env.VITE_ADO_DEV_TOKEN}`;

    fetch("https://dev.azure.com/microsoft/OS/_apis/wit/workitems?ids=38388130&api-version=6.0", {
      headers: { Authorization: `Basic ${btoa(creds)}` },
    })
      .then((result) => result.json())
      .then((result) => console.log(result));
  }, []);

  return <div>WorkItemList</div>;
};
