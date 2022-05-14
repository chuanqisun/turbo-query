// Ref and credit: https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
// Remove accent and diacritic
export function normalizeUnicode(raw: string): string {
  return raw
    .normalize("NFD") // remove accent step 1
    .replace(/\p{Diacritic}/gu, ""); // remove accent step 2
}
