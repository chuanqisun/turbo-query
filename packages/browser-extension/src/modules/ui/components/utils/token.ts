export function tokenize(input: string): string[] {
  return input
    .normalize("NFD") // remove accent step 1
    .replace(/[\u0300-\u036f]/g, "") // remove accent step 2
    .replace(/\s+/g, " ")
    .split(" ")
    .map((token) => token.toLocaleLowerCase().trim())
    .filter((token) => token.length);
}
