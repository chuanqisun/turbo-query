import React, { useCallback, useEffect, useState } from "react";
import { DisplayItem } from "../../service/utils/get-display-item";

export interface UseKeyboardNavigationProps {
  displayItems?: DisplayItem[];
  query: string;
  inputRef: React.RefObject<HTMLInputElement>;
}
export function useKeyboardNavigation({ displayItems, inputRef, query }: UseKeyboardNavigationProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const handleArrowKeys = useCallback<React.KeyboardEventHandler>(
    (e) => {
      const count = displayItems?.length;
      if (!count) return; // including 0

      switch (e.code) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % count);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev + count - 1) % count);
          break;
        case "KeyJ":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setActiveIndex((prev) => (prev + 1) % count);
            break;
          }
        case "KeyK":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setActiveIndex((prev) => (prev + count - 1) % count);
            break;
          }
      }
    },
    [displayItems]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    document.querySelector<HTMLElement>(`[data-item-active="true"]`)?.focus();
    inputRef.current?.focus();
  }, [activeIndex]);

  return {
    activeIndex,
    handleArrowKeys,
  };
}
