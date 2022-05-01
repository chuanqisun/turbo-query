import { useEffect, useState } from "react";
import { Config } from "../../service/ado/api-proxy";
import { getCompleteConfig } from "../../service/ado/config";

export function useConfigGuard(onMissingConfig: () => any) {
  const [config, setConfig] = useState<Config>();
  useEffect(() => {
    getCompleteConfig().then((config) => {
      if (!config) {
        onMissingConfig();
      } else {
        setConfig(config);
      }
    });
  }, []);

  return config;
}
