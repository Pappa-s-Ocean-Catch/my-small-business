type AuthUserMetadata = {
  app_metadata?: unknown;
  user_metadata?: unknown;
};

export function getRecoveryTokens(hash: string): {
  accessToken: string;
  refreshToken: string;
} | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export function hasPasswordLogin(user: AuthUserMetadata): boolean {
  const metadata = user.user_metadata as { has_password?: unknown } | undefined;
  return metadata?.has_password === true;
}

export function withRedirectTo(actionLink: string, redirectTo: string): string {
  const url = new URL(actionLink);
  url.searchParams.set('redirect_to', redirectTo);
  return url.toString();
}
