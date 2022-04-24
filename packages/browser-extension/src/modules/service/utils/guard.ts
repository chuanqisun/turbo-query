export function isDefined<T>(maybeDefined: T | undefined): maybeDefined is T {
  return maybeDefined !== undefined;
}
