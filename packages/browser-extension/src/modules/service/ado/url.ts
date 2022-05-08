export function getItemUrl(org: string, project: string, id: number) {
  return `https://dev.azure.com/${org}/${project}/_workitems/edit/${id}`;
}
