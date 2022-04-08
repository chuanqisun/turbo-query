export interface Config {
  org: string;
  project: string;
  team: string;
  areaPath: string;
  email: string;
  pat: string;
}

export async function getConfig(): Promise<Config> {
  const config = await chrome.storage.sync.get(["org", "project", "team", "areaPath", "email", "pat"]);
  return config as Config;
}

export async function setConfig(config: Partial<Config>) {
  await chrome.storage.sync.set(config);
}
