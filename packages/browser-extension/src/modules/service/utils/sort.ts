import { DbWorkItem } from "../../db/db";

export function sortByState(a: DbWorkItem, b: DbWorkItem): number {
  return getStatePriority(a.state) - getStatePriority(b.state);
}

function getStatePriority(state: string): number {
  switch (state) {
    case "Completed":
      return 1;
    case "Cut":
      return 2;
    default:
      return 0;
  }
}
