export async function copyRichText(html: string, plaintext: string) {
  function listener(e: ClipboardEvent) {
    e.clipboardData?.setData("text/html", html);
    e.clipboardData?.setData("text/plain", plaintext);
    e.preventDefault();
  }
  document.addEventListener("copy", listener);
  document.execCommand("copy");
  document.removeEventListener("copy", listener);
  console.log("oc");
  // }
}
