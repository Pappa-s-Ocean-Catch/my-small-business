const DEFAULT_SITE_URL = 'https://pappasfishnchips.com.au';
const DEFAULT_STORE_NAME = "Pappa's Ocean Catch";
const DEFAULT_STORE_ADDRESS_LINES = ['Shop 2/87 Unitt Street', 'Melton VIC 3337'];
const DEFAULT_STORE_PHONE = '(03) 9743 8150';

function normalizeLines(lines: Array<string | null | undefined>) {
  return lines
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
}

export function getReceiptWebsiteUrl() {
  return (process.env.EXPO_PUBLIC_SITE_URL || DEFAULT_SITE_URL).trim() || DEFAULT_SITE_URL;
}

export function getReceiptQrLandingUrl() {
  return `${getReceiptWebsiteUrl().replace(/\/+$/, '')}/qr`;
}

export function getReceiptOrderClaimUrl(token: string) {
  return `${getReceiptWebsiteUrl().replace(/\/+$/, '')}/rewards/claim?token=${encodeURIComponent(token.trim())}`;
}

export function getReceiptStoreName() {
  return (process.env.EXPO_PUBLIC_RECEIPT_STORE_NAME || DEFAULT_STORE_NAME).trim() || DEFAULT_STORE_NAME;
}

export function getReceiptStoreAddressLines() {
  const configuredLines = normalizeLines([
    process.env.EXPO_PUBLIC_RECEIPT_STORE_ADDRESS_LINE1,
    process.env.EXPO_PUBLIC_RECEIPT_STORE_ADDRESS_LINE2,
  ]);

  if (configuredLines.length > 0) {
    return configuredLines;
  }

  return DEFAULT_STORE_ADDRESS_LINES;
}

export function getReceiptStorePhone() {
  return (process.env.EXPO_PUBLIC_RECEIPT_STORE_PHONE || DEFAULT_STORE_PHONE).trim() || DEFAULT_STORE_PHONE;
}
