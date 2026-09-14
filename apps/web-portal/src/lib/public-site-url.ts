/**
 * Base origin for absolute links in emails and server-side code.
 * Trailing slashes are removed so paths can be appended as `${base}/foo`.
 */
export function getPublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  return "https://localhost:3000";
}
