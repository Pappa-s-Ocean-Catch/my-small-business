export function buildStaffAuthorizationHeader(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}
