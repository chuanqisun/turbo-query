export function getRootQuery(rootAreaPath: string, IsDeleted = false) {
  return `
SELECT
	[System.Id]
FROM workitems
WHERE
	[System.TeamProject] = @project
	AND [System.IsDeleted] = ${IsDeleted ? "true" : "false"}
	AND (
			[System.AreaPath] UNDER '${rootAreaPath}'
			AND (
					[System.WorkItemType] = 'Deliverable'
					OR [System.WorkItemType] = 'Bug'
					OR [System.WorkItemType] = 'Task'
					OR [System.WorkItemType] = 'Scenario'
			)
	)
ORDER BY [System.ChangedDate] DESC`.trim();
}
