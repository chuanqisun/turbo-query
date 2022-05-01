import React, { MutableRefObject, useEffect, useRef, useState } from "react";

export function useIsVisible(ref: React.RefObject<HTMLElement>, options?: IntersectionObserverInit) {
  const observerRef: MutableRefObject<IntersectionObserver | null> = useRef(null);
  const [isFullyVisible, setIsFullyVisible] = useState<boolean>();

  useEffect(() => {
    if (ref.current) {
      const observer = new IntersectionObserver((entries) => {
        setIsFullyVisible(entries[0].intersectionRatio > 0);
      }, options);

      observer.observe(ref.current);
      observerRef.current = observer;
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return isFullyVisible;
}
