export interface GetPatHeaderInput {
  email: string;
  pat: string;
}
export function getPatHeader(input: GetPatHeaderInput) {
  const creds = `${input.email}:${input.pat}`;
  return { Authorization: `Basic ${btoa(creds)}` };
}
