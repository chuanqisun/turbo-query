export function selectElementContent(e: HTMLElement) {
  let selection: Selection | null;
  let range: Range;

  selection = window.getSelection();
  range = document.createRange();
  range.selectNodeContents(e);
  selection?.removeAllRanges();
  selection?.addRange(range);
}
