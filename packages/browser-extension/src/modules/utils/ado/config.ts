import type { Config } from "./api-proxy";

export async function getConfig(): Promise<Config> {
  const config = await chrome.storage.sync.get(["org", "project", "areaPath", "email", "pat"]);
  return config as Config;
}

export async function getCompleteConfig(): Promise<Config | null> {
  const config = await getConfig();
  return isConfigComplete(config) ? config : null;
}

export function isConfigComplete(config: Config): boolean {
  return !!(config.org?.length && config.project?.length && config.areaPath?.length && config.email?.length && config.pat?.length);
}

export async function setConfig(config: Partial<Config>) {
  await chrome.storage.sync.set(config);
}
