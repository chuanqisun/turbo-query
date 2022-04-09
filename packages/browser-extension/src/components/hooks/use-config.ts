import { useEffect, useState } from "react";
import { Config, getConfig } from "../utils/config";

export function useConfig(onMissingConfig: () => any) {
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
