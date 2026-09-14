/**
 * Public Vercel Blob URLs use hostnames ending in .blob.vercel-storage.com
 * (e.g. *.public.blob.vercel-storage.com).
 */
export function isVercelBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** Path inside the store, e.g. `sale_product/foo.jpg` (no leading slash). */
export function vercelBlobPathnameFromUrl(blobUrl: string): string {
  const u = new URL(blobUrl);
  return u.pathname.replace(/^\//, "");
}
