import { supabase } from './supabase';
import { getApiUrl } from '@/utils/orderUtils';

export type MarketingChannel = 'email' | 'sms';

export type MarketingRecipient = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type MarketingGenerateResult = {
  subject: string;
  htmlBody: string;
  smsBody: string;
};

export async function getMarketingAccessToken() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error(error?.message || 'Missing authenticated session');
  }

  return session.access_token;
}

export async function generateMarketingCampaign(discountPercentage: number): Promise<MarketingGenerateResult> {
  const response = await fetch(getApiUrl('/api/marketing/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discountPercentage }),
  });

  const payload = await response.json().catch(() => null) as Partial<MarketingGenerateResult> & { error?: string } | null;
  if (!response.ok || !payload?.subject || !payload?.htmlBody || !payload?.smsBody) {
    throw new Error(payload?.error || 'Failed to generate marketing content');
  }

  return {
    subject: payload.subject,
    htmlBody: payload.htmlBody,
    smsBody: payload.smsBody,
  };
}

export async function generateMarketingImage(params: {
  title: string;
  description?: string;
  discountPercentage: number;
}) {
  const token = await getMarketingAccessToken();
  const response = await fetch(getApiUrl('/api/ai/generate-image'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      productName: params.title,
      description: params.description,
      category: 'marketing flyer',
      context: `Create a restaurant promotional hero image for a ${params.discountPercentage}% off customer campaign. Focus on appetizing food, premium lighting, and an ad-ready composition.`,
      maxSizeKB: 350,
    }),
  });

  const payload = await response.json().catch(() => null) as { imageBase64?: string; error?: string } | null;
  if (!response.ok || !payload?.imageBase64) {
    throw new Error(payload?.error || 'Failed to generate marketing image');
  }

  return payload.imageBase64;
}

export async function sendMarketingCampaign(params: {
  customers: MarketingRecipient[];
  discountPercentage: number;
  subject?: string;
  htmlBody?: string;
  smsBody?: string;
  channels: MarketingChannel[];
}) {
  const token = await getMarketingAccessToken();
  const response = await fetch(getApiUrl('/api/marketing/send'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  const payload = await response.json().catch(() => null) as {
    error?: string;
    results?: Array<{ success?: boolean }>;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to send marketing campaign');
  }

  return payload;
}
