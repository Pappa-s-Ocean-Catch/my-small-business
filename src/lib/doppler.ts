export type DopplerSetSecretRequest = {
  project: string;
  config: string;
  name: string;
  value: string;
};

export type DopplerSetSecretResult = {
  success: boolean;
  error?: string;
};

const getDopplerToken = (): string => {
  const token = process.env.DOPPLER_TOKEN;
  if (!token) throw new Error('Missing DOPPLER_TOKEN');
  return token;
};

const getDopplerApiUrl = (): string => {
  return process.env.DOPPLER_API_URL || 'https://api.doppler.com';
};

/**
 * Set or update a secret in Doppler for a given project/config.
 * Uses the Service Token (read/write) with Bearer auth.
 */
export async function dopplerSetSecret(req: DopplerSetSecretRequest): Promise<DopplerSetSecretResult> {
  const token = getDopplerToken();
  const baseUrl = getDopplerApiUrl();

  try {
    const url = `${baseUrl}/v3/configs/config/secrets`;
    // Per Doppler API, either `secrets` or `change_requests` must be specified.
    // Use `secrets` to set/update a single secret.
    const body = {
      project: req.project,
      config: req.config,
      secrets: {
        [req.name]: req.value
      }
    } as const;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Doppler error (${res.status}): ${text}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown Doppler error' };
  }
}


