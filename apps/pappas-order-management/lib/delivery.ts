import { Linking } from 'react-native';

const DEFAULT_SITE_URL = 'https://pappasoceancatch.com.au';
const DEFAULT_STORE_ADDRESS = {
  address_line1: 'Shop 2/87 Unitt Street',
  city: 'Melton',
  state: 'VIC',
  postcode: '3337',
  country: 'AU',
  latitude: -37.678,
  longitude: 144.579,
};

export type DeliveryAddressDraft = {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postcode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  delivery_instructions?: string;
};

export type AddressSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

export type DeliveryQuoteResult = {
  quote_id: string;
  fee: number;
  currency: string;
  provider_name: string;
  expires_at: string | null;
  estimated_duration_seconds: number | null;
  estimated_duration_minutes: number | null;
  distance_km: number | null;
};

export type DeliveryFeeSummary = {
  orderBaseAmount: number;
  serviceFee: number;
  totalAmount: number;
};

function getWebBaseUrl() {
  return (process.env.EXPO_PUBLIC_SITE_URL || DEFAULT_SITE_URL).trim();
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getWebBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || 'Request failed');
  }
  return payload as T;
}

export async function fetchAddressSuggestions(input: string, country = 'au'): Promise<AddressSuggestion[]> {
  if (input.trim().length < 3) return [];
  const query = new URLSearchParams({ input, country }).toString();
  const payload = await fetchJson<{ success: true; data: AddressSuggestion[] }>(`/api/places/autocomplete?${query}`);
  return payload.data;
}

export async function fetchAddressDetails(placeId: string): Promise<DeliveryAddressDraft> {
  const query = new URLSearchParams({ placeId }).toString();
  const payload = await fetchJson<{ success: true; data: DeliveryAddressDraft }>(`/api/places/details?${query}`);
  return payload.data;
}

export async function requestDeliveryQuote(dropoffAddress: DeliveryAddressDraft): Promise<DeliveryQuoteResult> {
  const payload = await fetchJson<{ success: true; data: DeliveryQuoteResult }>('/api/delivery/quote', {
    method: 'POST',
    body: JSON.stringify({
      pickup_address: DEFAULT_STORE_ADDRESS,
      dropoff_address: {
        ...dropoffAddress,
        country: dropoffAddress.country || 'AU',
      },
    }),
  });
  return payload.data;
}

export async function calculateDeliveryFees(params: {
  subtotal: number;
  tax: number;
  deliveryFee: number;
}) {
  const payload = await fetchJson<{ success: true; data: DeliveryFeeSummary }>('/api/payments/calculate-fees', {
    method: 'POST',
    body: JSON.stringify({
      subtotal: params.subtotal,
      tax: params.tax,
      deliveryFee: params.deliveryFee,
      orderType: 'delivery',
    }),
  });
  return payload.data;
}

export async function createStripeCheckoutSession(params: {
  orderId: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  items: Array<{ name: string; description?: string; quantity: number; price: number }>;
  subtotal: number;
  promotionDiscount?: number;
  rewardPointsDiscount?: number;
  tax: number;
  deliveryFee: number;
  orderType: 'delivery';
}) {
  const payload = await fetchJson<{ sessionId: string; url: string; shortUrl?: string; serviceFee: number; isTestPhoneCheckout?: boolean }>('/api/payments/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return payload;
}

export async function sendPaymentLinkSms(params: {
  phone: string;
  customerName?: string;
  paymentUrl: string;
  orderId?: string;
  deliveryAddress?: string;
  totalAmount?: number;
  deliveryFee?: number;
  deliveryEtaMinutes?: number;
}) {
  const payload = await fetchJson<{ success: true; provider: string; result: string }>('/api/pos/send-payment-link-sms', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return payload;
}

export async function openExternalUrl(url: string) {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return;
  await Linking.openURL(trimmedUrl);
}
