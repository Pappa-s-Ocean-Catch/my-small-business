export async function readMarketplaceResponse(response: Response) {
  const raw = await response.text().catch(() => '');
  let payload: unknown = null;

  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    // Provider WAFs commonly return an HTML error page instead of JSON.
  }

  return { payload, rejection: classifyMarketplaceRejection(response, raw, payload) };
}

function classifyMarketplaceRejection(response: Response, raw: string, payload: unknown) {
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  const body = raw.toLowerCase();

  if (contentType.includes('text/html')) {
    return body.includes('cloudflare') || body.includes('just a moment')
      ? 'html-cloudflare'
      : 'html';
  }
  if (body.includes('unauthorized') || body.includes('authentication')) return 'json-authentication';
  const code = providerErrorCode(payload);
  if (code) return `json-${code}`;
  if (contentType.includes('application/json')) return 'json';
  return raw ? 'non-json' : 'empty';
}

function providerErrorCode(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = payload as Record<string, unknown>;
  const candidate = value.errorCode ?? value.code ?? value.statusCode
    ?? (typeof value.error === 'object' && value.error ? (value.error as Record<string, unknown>).code : undefined)
    ?? (Array.isArray(value.errors) && typeof value.errors[0] === 'object' && value.errors[0]
      ? (value.errors[0] as Record<string, unknown>).code
      : undefined);
  if (typeof candidate !== 'string' && typeof candidate !== 'number') return null;
  const normalized = String(candidate).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 80);
  return normalized || null;
}
