import { useState, useEffect, useRef, MutableRefObject } from "react";

export function useFullyVisible(ref: React.RefObject<HTMLElement>) {
  const observerRef: MutableRefObject<IntersectionObserver | null> =
    useRef(null);
  const [isFullyVisible, setIsFullyVisible] = useState<boolean>();

  useEffect(() => {
    if (ref.current) {
      const options = {
        /** leave root undefined to observe the entire window */
        rootMargin: "0px",
        threshold: 1.0,
      };

      const observer = new IntersectionObserver((entries) => {
        setIsFullyVisible(entries[0].intersectionRatio === 1);
      }, options);

      observer.observe(ref.current);
      observerRef.current = observer;
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [ref.current]);

  return isFullyVisible;
}
