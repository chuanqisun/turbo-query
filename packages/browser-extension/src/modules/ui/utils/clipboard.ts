import React from "react";
import { VISUAL_FEEDBACK_DELAY } from "../hooks/use-event-handlers";
import { selectElementContent } from "./dom";

export const copyDataHtml: React.ClipboardEventHandler<HTMLElement> = (e) => {
  // execute copy
  const html = (e.target as HTMLElement)?.closest("[data-copy-html]")?.getAttribute("data-copy-html") ?? "";
  console.log(`[clipboard] copying html`, html);

  const copyContainer = document.createElement("div");
  copyContainer.innerHTML = html;

  copyContainer.style.position = "absolute";
  copyContainer.style.left = "-10000px";
  copyContainer.style.overflow = "hidden";

  document.body.append(copyContainer);
  const { savedRange } = selectElementContent(copyContainer);

  setTimeout(() => {
    copyContainer.remove();

    // restore selection
    if (savedRange) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange);
    }
  }, VISUAL_FEEDBACK_DELAY); // Use timeout to introduce a small delay as visual feedback for successful copy
};
