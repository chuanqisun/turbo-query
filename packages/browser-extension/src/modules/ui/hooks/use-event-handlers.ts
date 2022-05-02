import { useCallback, useEffect } from "react";
import { selectElementContent } from "../utils/dom";

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

export function useHandleIconCopy() {
  const handleIconCopy: React.ClipboardEventHandler<HTMLElement> = useCallback((e) => {
    const li = (e.target as HTMLElement).closest("li");
    const copyElement = li?.querySelector<HTMLElement>(".js-copy-target");
    if (copyElement) {
      // reveal content during copying
      copyElement.classList.add("u-visually-hidden--copying");
      selectElementContent(copyElement);

      // setTimeout to allow browser to finish copying. The selection will flash briefly, which is desired as visual feedback.
      setTimeout(() => {
        copyElement.classList.remove("u-visually-hidden--copying");
        // restore selection after
        const li = (e.target as HTMLElement).closest("li");
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

export interface UseHandleLinkClickProps {}
export function useHandleLinkClick() {
  return useCallback<React.MouseEventHandler>(async (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault(); // allows alt click to be no-op

    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const url = (e.target as HTMLAnchorElement).href;

    if (isCtrl) {
      chrome.tabs.create({ url, active: isShift });
    } else {
      chrome.tabs.update({ url });
    }
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
