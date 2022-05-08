import React from "react";
import { VISUAL_FEEDBACK_DELAY } from "../hooks/use-event-handlers";

// ref: https://w3c.github.io/clipboard-apis/#override-copy
export const copyDataHtml: React.ClipboardEventHandler<HTMLElement> = (e) => {
  blinkSelection();
  const html = (e.target as HTMLElement)?.closest("[data-copy-html]")?.getAttribute("data-copy-html") ?? "";

  const copyContainer = document.createElement("div");
  copyContainer.innerHTML = html;
  const text = copyContainer.innerText;

  e.clipboardData.setData("text/html", html);
  e.clipboardData.setData("text/plain", text);

  e.preventDefault();
};

export const copyDataText: React.ClipboardEventHandler<HTMLElement> = (e) => {
  blinkSelection();
  const text = (e.target as HTMLElement)?.closest("[data-copy-text]")?.getAttribute("data-copy-text") ?? "";

  e.clipboardData.setData("text/plain", text);
  e.preventDefault();
};

function blinkSelection() {
  // create visual feedback
  const selection = window.getSelection();
  const savedRange = selection?.rangeCount === 0 ? null : selection?.getRangeAt(0);
  selection?.removeAllRanges();

  // restore selection
  setTimeout(() => {
    if (savedRange) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange);
    }
  }, VISUAL_FEEDBACK_DELAY); // Use timeout to introduce a small delay as visual feedback for successful copy
}
