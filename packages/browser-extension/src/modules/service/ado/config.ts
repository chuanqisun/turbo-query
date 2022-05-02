import type { Config } from "./api-proxy";

export async function getConfig(): Promise<Config> {
  const config = await chrome.storage.sync.get(["org", "areaPath", "email", "pat"]);

  const fullConfig = {
    ...config,
    project: getProjectFromAreaPath(config.areaPath ?? ""),
  } as Config;

  return fullConfig;
}

export async function getCompleteConfig(): Promise<Config | null> {
  const config = await getConfig();
  return isConfigComplete(config) ? config : null;
}

export function isConfigComplete(config: Config): boolean {
  return !!(config.org?.length && config.project?.length && config.areaPath?.length && config.email?.length && config.pat?.length);
}

export function normalizeAreaPath(areaPath: string): string {
  return areaPath
    .trim()
    .replaceAll("/", "\\")
    .split("\\")
    .map((segment) => segment.trim())
    .filter((segment) => !!segment.length)
    .join("\\");
}

function getProjectFromAreaPath(areaPath: string): string {
  return areaPath.split("\\")[0] ?? "";
}
