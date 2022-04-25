export function selectElementContent(element: HTMLElement, endElement?: HTMLElement) {
  let selection: Selection | null;
  let range: Range;

  selection = window.getSelection();
  range = document.createRange();
  range.selectNodeContents(element);
  if (endElement) {
    range.setEndAfter(endElement);
  }
  selection?.removeAllRanges();
  selection?.addRange(range);
}
