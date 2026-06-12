import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'pappas-order-management.smartpay-pos.v1';
export const SMARTPAY_PRODUCTION_URL = 'https://api.smart-connect.cloud/POS';

export type SmartpayPairingSettings = {
  environmentUrl: string;
  posRegisterId: string;
  posRegisterName: string;
  posBusinessName: string;
  posVendorName: string;
  contactName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  email: string;
  phone: string;
  pairedAt: string | null;
};

export class SmartpayRequestError extends Error {
  status: number | null;
  statusText: string | null;
  errorCode: string | null;
  responseBody: string | null;
  responseJson: unknown;
  requestUrl: string | null;
  requestBody: string | null;

  constructor(message: string, options: {
    status?: number | null;
    statusText?: string | null;
    errorCode?: string | null;
    responseBody?: string | null;
    responseJson?: unknown;
    requestUrl?: string | null;
    requestBody?: string | null;
  } = {}) {
    super(message);
    this.name = 'SmartpayRequestError';
    this.status = options.status ?? null;
    this.statusText = options.statusText ?? null;
    this.errorCode = options.errorCode ?? null;
    this.responseBody = options.responseBody ?? null;
    this.responseJson = options.responseJson;
    this.requestUrl = options.requestUrl ?? null;
    this.requestBody = options.requestBody ?? null;
  }
}

export function formatSmartpayError(error: unknown) {
  if (error instanceof SmartpayRequestError) {
    const details = [
      error.message,
      error.requestUrl ? `Request URL: ${error.requestUrl}` : null,
      error.requestBody ? `Request body: ${error.requestBody}` : null,
      error.status ? `HTTP status code: ${error.status}` : null,
      error.statusText ? `HTTP status text: ${error.statusText}` : null,
      error.errorCode ? `Smartpay error code: ${error.errorCode}` : null,
      error.responseBody ? `Raw response: ${error.responseBody}` : null,
    ].filter(Boolean);
    return details.join('\n\n');
  }

  return error instanceof Error ? error.message : 'Smartpay request failed.';
}

export const DEFAULT_SMARTPAY_PAIRING_SETTINGS: SmartpayPairingSettings = {
  environmentUrl: SMARTPAY_PRODUCTION_URL,
  posRegisterId: '',
  posRegisterName: 'Main Register',
  posBusinessName: 'Pappas',
  posVendorName: 'Pappas Order Management',
  contactName: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  email: '',
  phone: '',
  pairedAt: null,
};

function randomHex(length: number) {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += Math.floor(Math.random() * 16).toString(16);
  }
  return result;
}

function generateDeviceId() {
  const globalCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }

  return [
    randomHex(8),
    randomHex(4),
    `4${randomHex(3)}`,
    `${(8 + Math.floor(Math.random() * 4)).toString(16)}${randomHex(3)}`,
    randomHex(12),
  ].join('-');
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

export async function loadSmartpayPairingSettings(): Promise<SmartpayPairingSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed = raw ? JSON.parse(raw) as Partial<SmartpayPairingSettings> | null : null;

  const settings: SmartpayPairingSettings = {
    environmentUrl: SMARTPAY_PRODUCTION_URL,
    posRegisterId: stringOrDefault(parsed?.posRegisterId, '') || generateDeviceId(),
    posRegisterName: stringOrDefault(parsed?.posRegisterName, DEFAULT_SMARTPAY_PAIRING_SETTINGS.posRegisterName),
    posBusinessName: stringOrDefault(parsed?.posBusinessName, DEFAULT_SMARTPAY_PAIRING_SETTINGS.posBusinessName),
    posVendorName: stringOrDefault(parsed?.posVendorName, DEFAULT_SMARTPAY_PAIRING_SETTINGS.posVendorName),
    contactName: stringOrDefault(parsed?.contactName, ''),
    address: stringOrDefault(parsed?.address, ''),
    city: stringOrDefault(parsed?.city, ''),
    state: stringOrDefault(parsed?.state, ''),
    zipCode: stringOrDefault(parsed?.zipCode, ''),
    email: stringOrDefault(parsed?.email, ''),
    phone: stringOrDefault(parsed?.phone, ''),
    pairedAt: typeof parsed?.pairedAt === 'string' ? parsed.pairedAt : null,
  };

  await saveSmartpayPairingSettings(settings);
  return settings;
}

export async function saveSmartpayPairingSettings(settings: SmartpayPairingSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...settings,
    environmentUrl: SMARTPAY_PRODUCTION_URL,
  }));
}

export async function loadSmartpayRegisterId(): Promise<string> {
  const settings = await loadSmartpayPairingSettings();
  return settings.posRegisterId;
}

export async function isSmartpayPaired(): Promise<boolean> {
  const settings = await loadSmartpayPairingSettings();
  return Boolean(settings.pairedAt);
}

export type SmartpayTransactionResponse = {
  transactionId?: string;
  transactionStatus?: 'PENDING' | 'COMPLETED' | string;
  data?: {
    PollingUrl?: string;
    TransactionResult?: string;
    Result?: string;
    ResultText?: string;
    AuthId?: string;
    AcquirerRef?: string;
    TerminalRef?: string;
    CardPan?: string;
    CardType?: string;
    Receipt?: string;
    AmountTotal?: string;
  };
  error?: string;
};

export type SmartpayCardPaymentResult = {
  transactionId: string | null;
  authId: string | null;
  cardPan: string | null;
  cardType: string | null;
  receipt: string | null;
  raw: SmartpayTransactionResponse;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseJsonResponse(text: string): SmartpayTransactionResponse {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text };
  }
}

function getSmartpayErrorCode(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const value = (json as any).errorCode ?? (json as any).code ?? (json as any).error_code;
  return value === undefined || value === null ? null : String(value);
}

function centsFromAmount(amount: number) {
  return Math.round(amount * 100);
}

async function fetchSmartpayJson(url: string, init?: RequestInit): Promise<SmartpayTransactionResponse> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new SmartpayRequestError(
      error instanceof Error ? error.message : 'Smartpay request failed before receiving a response.',
      {
        requestUrl: url,
        requestBody: typeof init?.body === 'string' ? init.body : null,
      }
    );
  }
  const text = await response.text();
  const json = parseJsonResponse(text);

  if (!response.ok) {
    throw new SmartpayRequestError(
      json.error || text || `Smartpay request failed with HTTP ${response.status}.`,
      {
        status: response.status,
        statusText: response.statusText || null,
        errorCode: getSmartpayErrorCode(json),
        responseBody: text || null,
        responseJson: json,
        requestUrl: url,
        requestBody: typeof init?.body === 'string' ? init.body : null,
      }
    );
  }

  return json;
}

export async function processSmartpayCardPayment(
  amount: number,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<SmartpayCardPaymentResult> {
  const amountCents = centsFromAmount(amount);
  if (amountCents <= 0) {
    throw new Error('Smartpay payment amount must be greater than zero.');
  }

  const settings = await loadSmartpayPairingSettings();
  const body = new URLSearchParams();
  body.set('POSRegisterID', settings.posRegisterId.trim());
  body.set('POSBusinessName', settings.posBusinessName.trim());
  body.set('POSVendorName', settings.posVendorName.trim());
  body.set('TransactionMode', 'ASYNC');
  body.set('TransactionType', 'Card.Purchase');
  body.set('AmountTotal', String(amountCents));

  const started = await fetchSmartpayJson(`${SMARTPAY_PRODUCTION_URL}/Transaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const pollingUrl = started.data?.PollingUrl;
  if (!pollingUrl) {
    throw new Error(started.error || 'Smartpay did not return a polling URL.');
  }

  const timeoutMs = options.timeoutMs ?? 180000;
  const pollIntervalMs = Math.max(options.pollIntervalMs ?? 2000, 2000);
  const startedAt = Date.now();
  let latest = started;

  while (Date.now() - startedAt < timeoutMs) {
    await sleep(pollIntervalMs);
    latest = await fetchSmartpayJson(pollingUrl);

    if (latest.transactionStatus !== 'COMPLETED') {
      continue;
    }

    if (latest.data?.TransactionResult === 'OK-ACCEPTED') {
      return {
        transactionId: latest.transactionId ?? started.transactionId ?? null,
        authId: latest.data.AuthId ?? null,
        cardPan: latest.data.CardPan ?? null,
        cardType: latest.data.CardType ?? null,
        receipt: latest.data.Receipt ?? null,
        raw: latest,
      };
    }

    throw new Error(latest.data?.ResultText || latest.data?.TransactionResult || latest.data?.Result || 'Smartpay payment was not accepted.');
  }

  throw new Error(latest.data?.ResultText || 'Smartpay payment timed out. Check the terminal before trying again.');
}

export type PairSmartpayInput = SmartpayPairingSettings & {
  pairingCode: string;
};

export async function pairSmartpayTerminal(input: PairSmartpayInput): Promise<SmartpayPairingSettings> {
  const { pairingCode: rawPairingCode, ...settings } = input;
  const pairingCode = rawPairingCode.trim();
  const environmentUrl = SMARTPAY_PRODUCTION_URL;

  if (!environmentUrl) throw new Error('Smartpay environment URL is required.');
  if (!pairingCode) throw new Error('Pairing code is required.');
  if (!input.posRegisterId.trim()) throw new Error('Register ID is required.');
  if (!input.posRegisterName.trim()) throw new Error('Register name is required.');
  if (!input.posBusinessName.trim()) throw new Error('Business name is required.');
  if (!input.posVendorName.trim()) throw new Error('POS vendor name is required.');

  const body = new URLSearchParams();
  body.set('POSRegisterID', input.posRegisterId.trim());
  body.set('POSRegisterName', input.posRegisterName.trim());
  body.set('POSBusinessName', input.posBusinessName.trim());
  body.set('POSVendorName', input.posVendorName.trim());
  if (input.contactName.trim()) body.set('Contact Name', input.contactName.trim());
  if (input.address.trim()) body.set('Address', input.address.trim());
  if (input.city.trim()) body.set('City', input.city.trim());
  if (input.state.trim()) body.set('State', input.state.trim());
  if (input.zipCode.trim()) body.set('ZipCode', input.zipCode.trim());
  if (input.email.trim()) body.set('Email', input.email.trim());
  if (input.phone.trim()) body.set('Phone', input.phone.trim());

  const requestUrl = `${environmentUrl}/Pairing/${encodeURIComponent(pairingCode)}`;
  const requestBody = body.toString();
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody,
    });
  } catch (error) {
    throw new SmartpayRequestError(
      error instanceof Error ? error.message : 'Smartpay pairing request failed before receiving a response.',
      {
        requestUrl,
        requestBody,
      }
    );
  }

  const responseText = await response.text();
  let responseJson: any = null;
  try {
    responseJson = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseJson = null;
  }

  if (!response.ok || responseJson?.result !== 'success') {
    throw new SmartpayRequestError(
      responseJson?.error || responseText || `Pairing failed with HTTP ${response.status}.`,
      {
        status: response.status,
        statusText: response.statusText || null,
        errorCode: getSmartpayErrorCode(responseJson),
        responseBody: responseText || null,
        responseJson,
        requestUrl,
        requestBody,
      }
    );
  }

  const nextSettings: SmartpayPairingSettings = {
    ...settings,
    environmentUrl,
    pairedAt: new Date().toISOString(),
  };
  await saveSmartpayPairingSettings(nextSettings);
  return nextSettings;
}
