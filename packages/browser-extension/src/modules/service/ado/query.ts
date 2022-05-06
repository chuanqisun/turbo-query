export interface WiqlConfig {
  rootAreaPath: string;
  /** @default false */
  isDeleted?: boolean;
}
export function getRootQuery({ rootAreaPath, isDeleted = false }: WiqlConfig) {
  return `
SELECT
	[System.Id]
FROM workitems
WHERE
	[System.TeamProject] = @project
	AND [System.IsDeleted] = ${isDeleted ? "true" : "false"}
	AND [System.AreaPath] UNDER '${rootAreaPath}'
ORDER BY [System.ChangedDate] DESC`.trim();
}
