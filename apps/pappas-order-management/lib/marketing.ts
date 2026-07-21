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

function buildFallbackMarketingCampaign(discountPercentage: number): MarketingGenerateResult {
  return {
    subject: `Enjoy ${discountPercentage}% off at {{STORE_NAME}}`,
    htmlBody: [
      '<p>Hi {{CUSTOMER_NAME}},</p>',
      `<p>{{STORE_NAME}} has a special ${discountPercentage}% off offer just for you.</p>`,
      '<p>Use code <strong>{{COUPON_CODE}}</strong> when ordering online.</p>',
      '<p><a href="{{STORE_LINK}}">Order online now</a></p>',
      '<p>Prefer to call? Phone us on <strong>{{STORE_PHONE}}</strong> and mention your code.</p>',
      '<p>Want to visit? Come and see us at <strong>{{STORE_ADDRESS}}</strong>.</p>',
      '<br><small><a href="{{UNSUBSCRIBE_LINK}}">Unsubscribe from marketing emails</a></small>',
    ].join(''),
    smsBody: `Hi {{CUSTOMER_NAME}}, enjoy ${discountPercentage}% off at {{STORE_NAME}} with code {{COUPON_CODE}}. Order online: {{STORE_LINK}}. Phone order: {{STORE_PHONE}}. Visit us: {{STORE_ADDRESS}}`,
  };
}

export async function getMarketingAccessToken() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error(error?.message || 'Missing authenticated session');
  }

  return session.access_token;
}

export async function generateMarketingCampaign(discountPercentage: number): Promise<MarketingGenerateResult> {
  try {
    const url = getApiUrl('/api/marketing/generate');
    console.log('[marketing] generateMarketingCampaign url', { url });
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discountPercentage }),
    });

    const payload = await response.json().catch(() => null) as Partial<MarketingGenerateResult> & { error?: string } | null;
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to generate marketing content');
    }

    return {
      subject: payload?.subject?.trim() || buildFallbackMarketingCampaign(discountPercentage).subject,
      htmlBody: payload?.htmlBody?.trim() || buildFallbackMarketingCampaign(discountPercentage).htmlBody,
      smsBody: payload?.smsBody?.trim() || buildFallbackMarketingCampaign(discountPercentage).smsBody,
    };
  } catch {
    return buildFallbackMarketingCampaign(discountPercentage);
  }
}

export async function generateMarketingImage(params: {
  title: string;
  description?: string;
  discountPercentage: number;
}) {
  const token = await getMarketingAccessToken();
  const url = getApiUrl('/api/ai/generate-image');
  console.log('[marketing] generateMarketingImage url', { url });
  const response = await fetch(url, {
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
  const url = getApiUrl('/api/marketing/send');
  console.log('[marketing] sendMarketingCampaign request', {
    url,
    customerCount: params.customers.length,
    channels: params.channels,
    discountPercentage: params.discountPercentage,
    customerIds: params.customers.map((customer) => customer.id),
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  const payload = await response.json().catch(() => null) as {
    error?: string;
    results?: Array<{
      success?: boolean;
      error?: string;
      channels?: MarketingChannel[];
      skippedChannels?: MarketingChannel[];
      customer?: { id?: string; email?: string | null; phone?: string | null };
    }>;
  } | null;

  console.log('[marketing] sendMarketingCampaign response', {
    ok: response.ok,
    status: response.status,
    payload,
  });

  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to send marketing campaign');
  }

  return payload;
}
