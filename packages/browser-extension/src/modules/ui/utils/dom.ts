export function selectElementContent(element: HTMLElement, endElement?: HTMLElement) {
  const selection = window.getSelection();
  const range = document.createRange();

  const savedRange = selection?.rangeCount === 0 ? null : selection?.getRangeAt(0);

  range.selectNodeContents(element);
  if (endElement) {
    range.setEndAfter(endElement);
  }

  selection?.removeAllRanges();
  selection?.addRange(range);

  return {
    savedRange,
  };
}
