export function getRootQuery(rootAreaPath: string, IsDeleted = false) {
  return `
SELECT
	[System.Id]
FROM workitems
WHERE
	[System.TeamProject] = @project
	AND [System.IsDeleted] = ${IsDeleted ? "true" : "false"}
	AND [System.AreaPath] UNDER '${rootAreaPath}'
ORDER BY [System.ChangedDate] DESC`.trim();
}
