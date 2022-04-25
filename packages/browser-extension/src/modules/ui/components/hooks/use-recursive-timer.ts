import { useEffect } from "react";
import { RecursiveTimer } from "../utils/recursive-poller";

export function useRecursiveTimer(callback: () => any, delay: number | null) {
  useEffect(() => {
    if (delay !== null) {
      const timer = new RecursiveTimer(callback, delay);
      timer.start();

      return () => timer.stop();
    }
  }, [callback, delay]);
}
