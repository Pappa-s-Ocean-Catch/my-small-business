/**
 * Bunny.net Edge Storage HTTP API (FTP & API password as AccessKey).
 * @see https://docs.bunny.net/storage/http
 */

function trimEnv(value: string | undefined): string {
  if (value === undefined) return '';
  const t = value.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

/** Bunny dashboard often shows hostname only; fetch() requires a full URL with scheme. */
function ensureStorageApiBase(host: string, fallback: string): string {
  const raw = host.trim().replace(/\/$/, '');
  if (!raw) return fallback.replace(/\/$/, '');
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
}

function getBunnyConfig(): {
  accessKey: string;
  storageZone: string;
  storageHost: string;
  publicBaseUrl: string;
} {
  // Password: Storage → your zone → "FTP & API Access" (NOT the global bunny.net API key).
  const accessKey = trimEnv(
    process.env.BUNNY_STORAGE_ACCESS_KEY ?? process.env.BUNNY_CDN_API_KEY,
  );
  const storageZone = trimEnv(process.env.BUNNY_STORAGE_ZONE);
  const publicBaseUrl = trimEnv(process.env.BUNNY_CDN_PUBLIC_URL).replace(/\/$/, '');
  const storageHost = ensureStorageApiBase(
    trimEnv(process.env.BUNNY_STORAGE_HOST),
    'https://storage.bunnycdn.com',
  );

  return { accessKey, storageZone, storageHost, publicBaseUrl };
}

export function isBunnyStorageConfigured(): boolean {
  const { accessKey, storageZone, publicBaseUrl } = getBunnyConfig();
  return Boolean(accessKey && storageZone && publicBaseUrl);
}

export function getBunnyConfigErrorMessage(): string {
  return (
    'Bunny upload is not configured. Set BUNNY_STORAGE_ZONE, BUNNY_CDN_PUBLIC_URL (pull zone URL, no trailing slash), ' +
    'and BUNNY_STORAGE_ACCESS_KEY or BUNNY_CDN_API_KEY (storage zone FTP & API password). ' +
    'Optional: BUNNY_STORAGE_HOST from the same FTP & API page if not Frankfurt (e.g. syd.storage.bunnycdn.com or https://syd.storage.bunnycdn.com).'
  );
}

function bunny401Hint(): string {
  return (
    'Bunny returned 401: use the Storage Zone password from Bunny dashboard → Storage → your zone → FTP & API Access ' +
    '(AccessKey), not your global bunny.net API key. Set BUNNY_STORAGE_HOST to the exact storage hostname shown there ' +
    'for your region (wrong region also returns 401). Confirm BUNNY_STORAGE_ZONE matches that zone name exactly.'
  );
}

function buildStorageObjectUrl(storageHost: string, storageZone: string, objectPath: string): string {
  const segments = [storageZone, ...objectPath.split('/').filter(Boolean)];
  const pathPart = segments.map((s) => encodeURIComponent(s)).join('/');
  return `${storageHost}/${pathPart}`;
}

function joinPublicUrl(publicBaseUrl: string, objectPath: string): string {
  const path = objectPath.replace(/^\//, '');
  return path ? `${publicBaseUrl}/${path}` : publicBaseUrl;
}

/**
 * Parse storage object path from a public CDN URL (must match BUNNY_CDN_PUBLIC_URL origin/path prefix).
 */
export function bunnyPublicUrlToObjectPath(publicFileUrl: string): string | null {
  const { publicBaseUrl } = getBunnyConfig();
  if (!publicBaseUrl) return null;

  let fileUrl: URL;
  let baseUrl: URL;
  try {
    fileUrl = new URL(publicFileUrl);
    baseUrl = new URL(publicBaseUrl);
  } catch {
    return null;
  }

  if (fileUrl.origin !== baseUrl.origin) return null;

  const baseSegments = baseUrl.pathname.split('/').filter(Boolean);
  const fileSegments = fileUrl.pathname.split('/').filter(Boolean);

  for (let i = 0; i < baseSegments.length; i++) {
    if (fileSegments[i] !== baseSegments[i]) return null;
  }

  const objectSegments = fileSegments.slice(baseSegments.length);
  if (objectSegments.length === 0) return null;
  return objectSegments.join('/');
}

export async function uploadToBunnyStorage(
  body: ArrayBuffer,
  contentType: string,
  objectPath: string,
): Promise<string> {
  const { accessKey, storageZone, storageHost, publicBaseUrl } = getBunnyConfig();

  if (!accessKey || !storageZone || !publicBaseUrl) {
    throw new Error(getBunnyConfigErrorMessage());
  }

  const putUrl = buildStorageObjectUrl(storageHost, storageZone, objectPath);
  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      AccessKey: accessKey,
      'Content-Type': contentType,
    },
    body: new Uint8Array(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const base = `Bunny upload failed (${res.status}): ${text || res.statusText}`;
    throw new Error(
      res.status === 401 ? `${base}. ${bunny401Hint()}` : base,
    );
  }

  return joinPublicUrl(publicBaseUrl, objectPath);
}

export async function deleteFromBunnyStorage(publicFileUrl: string): Promise<void> {
  const objectPath = bunnyPublicUrlToObjectPath(publicFileUrl);
  if (!objectPath) {
    throw new Error('URL is not a Bunny CDN URL for this project (check BUNNY_CDN_PUBLIC_URL).');
  }

  const { accessKey, storageZone, storageHost } = getBunnyConfig();
  if (!accessKey || !storageZone) {
    throw new Error(getBunnyConfigErrorMessage());
  }

  const deleteUrl = buildStorageObjectUrl(storageHost, storageZone, objectPath);
  const res = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      AccessKey: accessKey,
    },
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bunny delete failed (${res.status}): ${text || res.statusText}`);
  }
}
