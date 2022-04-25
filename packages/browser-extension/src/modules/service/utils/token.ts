// Ref and credit: https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
export function tokenize(input: string): string[] {
  return input
    .normalize("NFD") // remove accent step 1
    .replace(/\p{Diacritic}/gu, "") // remove accent step 2
    .replace(/\s+/g, " ")
    .split(" ")
    .map((token) => token.toLocaleLowerCase().trim())
    .filter((token) => token.length);
}
