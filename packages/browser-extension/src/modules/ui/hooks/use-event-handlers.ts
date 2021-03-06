import React, { useCallback, useEffect } from "react";
import { Config } from "../../service/ado/api-proxy";
import { getItemUrl } from "../../service/ado/url";
import { DisplayItem } from "../../service/utils/get-display-item";
import { selectElementContent } from "../utils/dom";

export const VISUAL_FEEDBACK_DELAY = 50;

export function useHandleIconClick() {
  const handleIconClick: React.MouseEventHandler<HTMLElement> = useCallback((e) => {
    const li = (e.target as HTMLElement).closest("li");
    const start = li?.querySelector<HTMLElement>(".js-select-item-start");
    const end = li?.querySelector<HTMLElement>(".js-select-item-end");
    if (start && end) {
      selectElementContent(start, end);
    }
  }, []);

  return handleIconClick;
}

export interface UseHandleQueryKeyDownProps {
  activeIndex: number;
  config?: Config;
  displayItems?: DisplayItem[];
}

export function useHandleQueryKeyDown({ activeIndex, displayItems, config }: UseHandleQueryKeyDownProps) {
  return useCallback<React.KeyboardEventHandler>(
    (e: React.KeyboardEvent) => {
      if (!config) return;

      const item = displayItems?.[activeIndex];
      if (e.code === "Enter" && item) {
        e.preventDefault();
        const targetItemElement = document.querySelector<HTMLElement>(`[data-item-active="true"]`);
        targetItemElement?.setAttribute("data-item-opening", "");
        const url = getItemUrl(config!.org, config!.project, item.id);
        navigateToUrl(url, e);
        setTimeout(() => {
          targetItemElement?.removeAttribute("data-item-opening");
        }, VISUAL_FEEDBACK_DELAY);
      }
    },
    [activeIndex, config, displayItems]
  );
}

export interface UseHandleLinkClickProps {}
export function useHandleLinkClick() {
  return useCallback<React.MouseEventHandler>(async (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault(); // allows alt click to be no-op
    const url = (e.target as HTMLAnchorElement).href;
    navigateToUrl(url, e);
  }, []);
}

export function useClickToSelect() {
  return useCallback<React.MouseEventHandler>((e: React.MouseEvent<HTMLElement>) => selectElementContent(e.target as HTMLElement), []);
}

export function useHandleEscapeGlobal(inputRef: React.RefObject<HTMLInputElement>) {
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      if (e.target === inputRef.current) {
        if (inputRef.current?.value.length) {
          // no-op when input has content
          return;
        } else {
          // close popup when escaping on empty input
          window.close();
        }
      } else {
        // re-focus on input
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);
}

export function useHandleTextFocus() {
  return useCallback<React.FocusEventHandler>((e: React.FocusEvent<HTMLSpanElement>) => selectElementContent(e.target as HTMLSpanElement), []);
}

export function useHandleTextBlur() {
  return useCallback<React.FocusEventHandler>((_e: React.FocusEvent<HTMLSpanElement>) => window.getSelection()?.removeAllRanges(), []);
}

export function useHandleSentinelFocus() {
  // trigger selection on sentinel focus
  return useCallback<React.FocusEventHandler>((e) => e.target.closest(".work-item")?.querySelector<HTMLElement>(".js-select-item-trigger")?.click(), []);
}

function navigateToUrl(url: string, e: React.MouseEvent | React.KeyboardEvent) {
  const isCtrl = e.ctrlKey || e.metaKey;
  const isShift = e.shiftKey;

  if (isCtrl) {
    chrome.tabs.create({ url, active: isShift });
  } else {
    chrome.tabs.update({ url });
  }
}
