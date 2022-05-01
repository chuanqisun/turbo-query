import { useEffect, useState } from "react";
import { Config } from "../../service/ado/api-proxy";
import { getConfig } from "../../service/ado/config";

export function useConfigGuard(onMissingConfig: () => any) {
  const [config, setConfig] = useState<Config>();
  useEffect(() => {
    getConfig().then((config) => {
      if (!Object.keys(config).length) {
        onMissingConfig();
      } else {
        setConfig(config);
      }
    });
  }, []);

  return config;
}
