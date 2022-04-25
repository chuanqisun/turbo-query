import { useCallback } from "react";
import { selectElementContent } from "../utils/dom";

export function useHandleIconClick() {
  const handleIconClick: React.MouseEventHandler<HTMLElement> = useCallback((e) => {
    const li = (e.target as SVGElement).closest("li");
    const start = li?.querySelector<HTMLElement>(".js-select-item-start");
    const end = li?.querySelector<HTMLElement>(".js-select-item-end");
    if (start && end) {
      selectElementContent(start, end);
    }
  }, []);

  return handleIconClick;
}

export function useHandleIconCopy() {
  const handleIconCopy: React.ClipboardEventHandler<HTMLElement> = useCallback((e) => {
    const li = (e.target as SVGElement).closest("li");
    const copyElement = li?.querySelector<HTMLElement>(".js-copy-target");
    if (copyElement) {
      selectElementContent(copyElement);
      setTimeout(() => {
        // restore selection after
        const li = (e.target as SVGElement).closest("li");
        const start = li?.querySelector<HTMLElement>(".js-select-item-start");
        const end = li?.querySelector<HTMLElement>(".js-select-item-end");
        if (start && end) {
          selectElementContent(start, end);
        }
      }, 0);
    }
  }, []);

  return handleIconCopy;
}

export function useHandleLinkClick() {
  return useCallback<React.MouseEventHandler>(async (e: React.MouseEvent<HTMLSpanElement>) => {
    e.preventDefault();

    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const url = (e.target as HTMLAnchorElement).href;

    if (isCtrl) {
      chrome.tabs.create({ url, active: isShift });
    } else {
      chrome.tabs.update({ url });
      window.close();
    }
  }, []);
}

export function useClickToSelect() {
  return useCallback<React.MouseEventHandler>((e: React.MouseEvent<HTMLElement>) => selectElementContent(e.target as HTMLElement), []);
}
