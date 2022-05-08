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
        case "KeyH":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            cycleFieldFocus("prev");
            break;
          }
        case "KeyL":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            cycleFieldFocus("next");
            break;
          }
      }
    },
    [displayItems]
  );

  const cycleFieldFocus = useCallback((dir: "prev" | "next") => {
    const activeItem = document.querySelector<HTMLElement>(`[data-item-active="true"]`);
    if (activeItem) {
      const focusable = [...activeItem.querySelectorAll<HTMLElement>(`[tabindex="0"]`)];
      const focusableCount = focusable.length;
      if (!focusableCount) return;

      let newIndex = focusable.findIndex((e) => e === document.activeElement);
      if (dir === "next") {
        newIndex = (newIndex + 1) % focusableCount;
      } else if (dir === "prev") {
        if (newIndex < 0) {
          newIndex = 0;
        }
        newIndex = (newIndex + focusableCount - 1) % focusableCount;
      }

      focusable[newIndex]?.focus();
    }
  }, []);

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
