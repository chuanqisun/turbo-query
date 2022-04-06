const metaEnv = import.meta.env as any;

export const env = {
  rootQueryId: "d105a6a1-f48f-417b-b737-3aa7920f9b19",
  rootDeletedQueryId: "6e1bf4a5-348f-4c7c-9cd3-f3efcb5033cd",
  userEmail: metaEnv.VITE_USER_EMAIL,
  adoDevToken: metaEnv.VITE_ADO_DEV_TOKEN,
};
