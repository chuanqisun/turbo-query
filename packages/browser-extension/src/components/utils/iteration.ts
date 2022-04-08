export function getShortIteration(iterationPath: string): string {
  const i = iterationPath.lastIndexOf("\\");
  const shortPath = iterationPath.slice(i + 1);
  return shortPath;
}
