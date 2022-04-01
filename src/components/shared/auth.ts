import { env } from "./env";

const creds = `${env.userEmail}:${env.adoDevToken}`;
export const patHeader = { Authorization: `Basic ${btoa(creds)}` };
