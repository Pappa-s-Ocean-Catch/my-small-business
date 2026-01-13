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

export async function getDopplerSecret(secretName: string): Promise<{ success: boolean; value?: string; error?: string }> {
  const token = getDopplerToken();
  const baseUrl = getDopplerApiUrl();
  const project = process.env.DOPPLER_PROJECT;
  const config = process.env.DOPPLER_CONFIG;

  if (!project || !config) {
    return { success: false, error: "Doppler project/config not configured." };
  }

  try {
    const url = `${baseUrl}/v3/configs/config/secrets?project=${project}&config=${config}`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Doppler error (${res.status}): ${text}` };
    }

    const data = await res.json();
    const secretValue = data.secrets?.[secretName];
    
    if (!secretValue) {
      return { success: false, error: 'Secret not found' };
    }

    return { success: true, value: secretValue };

  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown Doppler error' };
  }
}


