import { NextResponse } from 'next/server';
import {
  authenticateMarketplaceRequest,
  getMarketplaceCookies,
  getMarketplaceCredentialBundle,
  parseMarketplaceProvider,
  type MarketplaceProvider,
} from '@/lib/marketplace-credentials';

type RouteContext = {
  params: Promise<{ provider: string; workflowUuid: string }>;
};

type MarketplaceOrderDetailsResponse = {
  provider: MarketplaceProvider;
  sourceName: string;
  orderId: string;
  orderUUID: string;
  requestedAt: number;
  completedAtTimestamp: number | null;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  courierName: string | null;
  courierPhone: string | null;
  restaurantName: string;
  subtotal: string | null;
  subtotalAmount: number | null;
  discountLabel: string | null;
  discount: string | null;
  discountAmount: number;
  total: string | null;
  totalAmount: number | null;
  netPayout: string;
  marketplaceFeeRate: string | null;
  fulfillmentType: string;
  orderJobState: string | null;
  statusDescription: string | null;
  checkoutInfo: Array<{ key: string; amount: string; label: string }>;
  orderStateChanges: Array<{ changedAt: number; orderState: string }>;
  items: Array<{
    name: string;
    price: string;
    quantity: number;
    specialInstructions: string;
    customizations: Array<{
      name: string;
      options: Array<{
        name: string;
        quantity: number;
        price: string | null;
      }>;
    }>;
  }>;
};

type UberOrderItemOption = {
  name: string;
  quantity: number;
  price?: string | null;
};

type UberOrderItemCustomization = {
  name: string;
  options?: UberOrderItemOption[];
};

type UberOrderItem = {
  name: string;
  price: string;
  quantity: number;
  specialInstructions?: string | null;
  customizations?: UberOrderItemCustomization[];
};

type UberNormalizedOrderDetails = {
  requestedAt: number;
  orderId: string;
  orderUUID: string;
  completedAtTimestamp?: number | null;
  fulfillmentType: string;
  marketplaceFeeRate?: string | null;
  netPayout: string;
  eater?: {
    name?: string;
    phone?: string | null;
    deliveryAddress?: string | null;
  };
  courier?: {
    name?: string | null;
    phone?: string | null;
  };
  restaurant?: {
    name?: string;
    uuid?: string;
  };
  checkoutInfo?: Array<{
    key: string;
    amount: string;
    label: string;
  }>;
  orderStateChanges?: Array<{
    changedAt: number;
    orderState: string;
  }>;
  items?: UberOrderItem[];
  orderJobState?: string | null;
  statusDescription?: string | null;
};

type UberOrderDetailsResponse = {
  data?: {
    orderDetails?: {
      requestedAt: number;
      orderId: string;
      orderUUID: string;
      completedAtTimestamp?: number | null;
      fulfillmentType: string;
      marketplaceFeeRate?: string | null;
      netPayout: string;
      eater?: {
        name?: string;
        phone?: string | null;
        deliveryAddress?: string | null;
      };
      courier?: {
        name?: string | null;
        phone?: string | null;
      };
      restaurant?: {
        name?: string;
        uuid?: string;
      };
      issueSummaryV2?: {
        orderJobState?: string | null;
        statusDescription?: string | null;
      };
      checkoutInfo?: Array<{
        key: string;
        amount: string;
        label: string;
      }>;
      orderStateChanges?: Array<{
        changedAt: number;
        orderState: string;
      }>;
      items?: UberOrderItem[];
    };
    liveOrderDetails?: {
      requestedAt: number;
      orderId: string;
      orderUUID: string;
      completedAtTimestamp?: number | null;
      fulfillmentType: string;
      marketplaceFeeRate?: string | null;
      netPayout: string;
      eater?: {
        name?: string;
        phone?: string | null;
        deliveryAddress?: string | null;
      };
      courier?: {
        name?: string | null;
        phone?: string | null;
      };
      restaurant?: {
        name?: string;
        uuid?: string;
      };
      issueSummary?: {
        orderJobState?: string | null;
        failureReason?: string | null;
        issueType?: string | null;
      };
      checkoutInfo?: Array<{
        key: string;
        amount: string;
        label: string;
      }>;
      orderStateChanges?: Array<{
        changedAt: number;
        orderState: string;
      }>;
      items?: UberOrderItem[];
    };
  };
  errors?: Array<{ message?: string }>;
};

type DoorDashPrice = {
  displayString?: string;
  unitAmount?: number;
};

type DoorDashExtraOption = {
  name?: string;
  quantity?: number;
  price?: DoorDashPrice | null;
  title?: string | null;
};

type DoorDashExtra = {
  name?: string;
  title?: string | null;
  itemExtraOptions?: DoorDashExtraOption | null;
  itemExtraOptionsList?: DoorDashExtraOption[];
};

type DoorDashItem = {
  name?: string;
  quantity?: number;
  price?: DoorDashPrice | null;
  specialInstructions?: string | null;
  itemExtras?: DoorDashExtra[];
};

type DoorDashDetailResponse = {
  data?: {
    orderId?: string;
    orderExperience?: string;
    deliveryUuid?: string;
    orderDate?: string;
    quotedDeliveryTime?: string | null;
    actualDeliveryTime?: string | null;
    estimatedPickupTime?: string | null;
    actualPickupTime?: string | null;
    completedTime?: string | null;
    consumer?: {
      informalName?: string;
      formalNameAbbreviated?: string;
    };
    orders?: Array<{
      orderItems?: DoorDashItem[];
    }>;
    errors?: Array<{ code?: string; message?: string }>;
    dasher?: {
      informalName?: string;
      formalNameAbbreviated?: string;
    };
    fulfillmentType?: string;
    orderStatus?: number | string;
    orderStatusDisplay?: string;
    preTaxTotal?: DoorDashPrice | null;
    subtotal?: DoorDashPrice | null;
    orderTotal?: DoorDashPrice | null;
    discountDetails?: Array<{
      value?: DoorDashPrice | null;
      type?: string;
    }>;
    promoRedemptionDetails?: Array<{
      promotionTitle?: string | null;
    }>;
    storeName?: string | null;
    deliveryAddress?: {
      printableAddress?: string | null;
    } | null;
  };
  message?: string;
};

function extractSelectedRestaurantUuid(cookieHeader: string) {
  const match = cookieHeader.match(/(?:^|;\s*)selectedRestaurant=([^;]+)/);
  return match?.[1]?.trim() || null;
}

function buildOrderDetailsQuery() {
  return `query OrderDetails($workflowUUID: ID!, $metadata: Orders_OrderDetailsMetadataInput, $shouldEnableChargebackComms: Boolean, $detailsRequestedByRestaurantUUID: ID) {
  orderDetails(
    workflowUUID: $workflowUUID
    metadata: $metadata
    shouldEnableChargebackComms: $shouldEnableChargebackComms
    detailsRequestedByRestaurantUUID: $detailsRequestedByRestaurantUUID
  ) {
    requestedAt
    orderId
    orderUUID
    completedAtTimestamp
    fulfillmentType
    marketplaceFeeRate
    netPayout
    eater {
      name
      phone
      deliveryAddress
    }
    courier {
      name
      phone
    }
    restaurant {
      name
      uuid
    }
    checkoutInfo {
      key
      amount
      label
    }
    issueSummaryV2 {
      orderJobState
      statusDescription
    }
    orderStateChanges {
      changedAt
      orderState
    }
    items {
      name
      price
      quantity
      specialInstructions
      customizations {
        name
        options {
          name
          quantity
          price
        }
      }
    }
  }
}`;
}

function buildLiveOrderDetailsQuery() {
  return `query LiveOrderDetails($workflowUUID: ID!, $metadata: Orders_OrderDetailsMetadataInput) {
  liveOrderDetails(
    workflowUUID: $workflowUUID
    metadata: $metadata
  ) {
    requestedAt
    orderId
    orderUUID
    completedAtTimestamp
    fulfillmentType
    marketplaceFeeRate
    netPayout
    eater {
      name
      phone
      deliveryAddress
    }
    courier {
      name
      phone
    }
    restaurant {
      name
      uuid
    }
    checkoutInfo {
      key
      amount
      label
    }
    issueSummary {
      orderJobState
      failureReason
      issueType
    }
    orderStateChanges {
      changedAt
      orderState
    }
    items {
      name
      price
      quantity
      specialInstructions
      customizations {
        name
        options {
          name
          quantity
          price
        }
      }
    }
  }
}`;
}

function normalizeUberOrderDetails(details: UberNormalizedOrderDetails): MarketplaceOrderDetailsResponse {
  const normalizeEpochToMilliseconds = (value?: number | null) => {
    if (!value) return 0;
    return value < 1_000_000_000_000 ? value * 1000 : value;
  };
  const summary = buildUberSummary(details);

  return {
    provider: 'uber_eats',
    sourceName: 'Uber Eats',
    orderId: details.orderId,
    orderUUID: details.orderUUID,
    requestedAt: normalizeEpochToMilliseconds(details.requestedAt),
    completedAtTimestamp: details.completedAtTimestamp ? normalizeEpochToMilliseconds(details.completedAtTimestamp) : null,
    customerName: details.eater?.name || 'Customer',
    customerPhone: details.eater?.phone ?? null,
    customerAddress: details.eater?.deliveryAddress ?? null,
    courierName: details.courier?.name ?? null,
    courierPhone: details.courier?.phone ?? null,
    restaurantName: details.restaurant?.name || 'Restaurant',
    subtotal: summary.subtotal,
    subtotalAmount: summary.subtotalAmount,
    discountLabel: summary.discountLabel,
    discount: summary.discount,
    discountAmount: summary.discountAmount,
    total: summary.total,
    totalAmount: summary.totalAmount,
    netPayout: details.netPayout,
    marketplaceFeeRate: details.marketplaceFeeRate ?? null,
    fulfillmentType: details.fulfillmentType,
    orderJobState: details.orderJobState ?? null,
    statusDescription: details.statusDescription ?? null,
    checkoutInfo: (details.checkoutInfo || []).map((entry) => ({
      key: entry.key,
      amount: entry.amount,
      label: entry.label,
    })),
    orderStateChanges: (details.orderStateChanges || []).map((entry) => ({
      changedAt: normalizeEpochToMilliseconds(entry.changedAt),
      orderState: entry.orderState,
    })),
    items: (details.items || []).map((item) => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      specialInstructions: item.specialInstructions || '',
      customizations: (item.customizations || []).map((customization) => ({
        name: customization.name,
        options: (customization.options || []).map((option) => ({
          name: option.name,
          quantity: option.quantity,
          price: option.price ?? null,
        })),
      })),
    })),
  };
}

function parseDateToMilliseconds(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDoorDashPrice(price?: DoorDashPrice | null) {
  if (!price) return '';
  return price.displayString || (typeof price.unitAmount === 'number' ? `A$${(price.unitAmount / 100).toFixed(2)}` : '');
}

function parseMarketplaceAmount(value?: string | null) {
  if (!value) return null;
  const normalized = value.replace(/[^0-9.-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function parseDoorDashAmount(price?: DoorDashPrice | null) {
  if (!price) return null;
  if (typeof price.unitAmount === 'number') {
    return Math.round((price.unitAmount / 100) * 100) / 100;
  }
  return parseMarketplaceAmount(price.displayString);
}

function formatMarketplaceAmount(amount: number | null) {
  if (amount == null || !Number.isFinite(amount)) return null;
  return `A$${amount.toFixed(2)}`;
}

function isUberDiscountCheckoutEntry(entry: { key: string; label: string; amount: string }) {
  const amount = parseMarketplaceAmount(entry.amount);
  if (amount == null || amount >= 0) return false;

  const key = entry.key.toLowerCase();
  const label = entry.label.toLowerCase();
  if (key.includes('fee') || label.includes('fee')) return false;

  return (
    key.includes('promo')
    || key.includes('discount')
    || key.includes('merchantfunded')
    || label.includes('promo')
    || label.includes('discount')
  );
}

function buildUberSummary(details: UberNormalizedOrderDetails) {
  const checkoutInfo = details.checkoutInfo || [];
  const subtotalEntry = checkoutInfo.find((entry) => entry.key.toLowerCase().includes('subtotal')) || null;
  const subtotalAmount = subtotalEntry ? parseMarketplaceAmount(subtotalEntry.amount) : null;
  const discountEntries = checkoutInfo.filter(isUberDiscountCheckoutEntry);
  const discountAmount = Math.round(
    discountEntries.reduce((sum, entry) => sum + Math.abs(parseMarketplaceAmount(entry.amount) || 0), 0) * 100
  ) / 100;
  const totalAmount = subtotalAmount != null
    ? Math.max(0, Math.round((subtotalAmount - discountAmount) * 100) / 100)
    : null;

  return {
    subtotal: subtotalEntry?.amount ?? null,
    subtotalAmount,
    discountLabel: discountEntries[0]?.key || null,
    discount: discountAmount > 0 ? formatMarketplaceAmount(discountAmount) : null,
    discountAmount,
    total: totalAmount != null ? formatMarketplaceAmount(totalAmount) : null,
    totalAmount,
  };
}

function buildDoorDashSummary(payload: DoorDashDetailResponse['data'], items: Array<{ price: string }>) {
  const itemTotal = Math.round(
    items.reduce((sum, item) => sum + (parseMarketplaceAmount(item.price) || 0), 0) * 100
  ) / 100;
  const subtotalAmount = parseDoorDashAmount(payload?.preTaxTotal) ?? (itemTotal > 0 ? itemTotal : null);
  const discountAmount = Math.round(
    ((payload?.discountDetails || []).reduce((sum, entry) => sum + Math.abs(parseDoorDashAmount(entry.value) || 0), 0)) * 100
  ) / 100;
  const totalAmount = parseDoorDashAmount(payload?.orderTotal) ?? subtotalAmount;

  return {
    subtotal: subtotalAmount != null ? formatMarketplaceAmount(subtotalAmount) : null,
    subtotalAmount,
    discountLabel: payload?.promoRedemptionDetails?.[0]?.promotionTitle || (discountAmount > 0 ? 'Marketplace promo' : null),
    discount: discountAmount > 0 ? formatMarketplaceAmount(discountAmount) : null,
    discountAmount,
    total: totalAmount != null ? formatMarketplaceAmount(totalAmount) : null,
    totalAmount,
  };
}

function normalizeDoorDashOrderDetails(payload: DoorDashDetailResponse['data']): MarketplaceOrderDetailsResponse {
  const items = (payload?.orders || []).flatMap((order) => (
    (order.orderItems || []).map((item) => ({
      name: item.name || 'Item',
      price: formatDoorDashPrice(item.price),
      quantity: item.quantity || 1,
      specialInstructions: item.specialInstructions || '',
      customizations: (item.itemExtras || []).map((extra) => {
        const optionList = extra.itemExtraOptionsList && extra.itemExtraOptionsList.length > 0
          ? extra.itemExtraOptionsList
          : extra.itemExtraOptions
            ? [extra.itemExtraOptions]
            : [];

        return {
          name: extra.title || extra.name || 'Options',
          options: optionList.map((option) => ({
            name: option.name || 'Option',
            quantity: option.quantity || 1,
            price: option.price ? formatDoorDashPrice(option.price) : null,
          })),
        };
      }),
    }))
  ));
  const summary = buildDoorDashSummary(payload, items);

  const orderStateChanges = [
    payload?.estimatedPickupTime ? { changedAt: parseDateToMilliseconds(payload.estimatedPickupTime) || 0, orderState: 'ESTIMATED_PICKUP' } : null,
    payload?.actualPickupTime ? { changedAt: parseDateToMilliseconds(payload.actualPickupTime) || 0, orderState: 'PICKED_UP' } : null,
    payload?.quotedDeliveryTime ? { changedAt: parseDateToMilliseconds(payload.quotedDeliveryTime) || 0, orderState: 'ESTIMATED_DELIVERY' } : null,
    payload?.actualDeliveryTime ? { changedAt: parseDateToMilliseconds(payload.actualDeliveryTime) || 0, orderState: 'DELIVERED' } : null,
    payload?.completedTime ? { changedAt: parseDateToMilliseconds(payload.completedTime) || 0, orderState: 'COMPLETED' } : null,
  ].filter((entry): entry is { changedAt: number; orderState: string } => Boolean(entry));

  return {
    provider: 'doordash',
    sourceName: 'DoorDash',
    orderId: payload?.orderId || '',
    orderUUID: payload?.deliveryUuid || '',
    requestedAt: parseDateToMilliseconds(payload?.orderDate) || 0,
    completedAtTimestamp: parseDateToMilliseconds(payload?.completedTime),
    customerName: payload?.consumer?.informalName || payload?.consumer?.formalNameAbbreviated || 'Customer',
    customerPhone: null,
    customerAddress: payload?.deliveryAddress?.printableAddress || null,
    courierName: payload?.dasher?.informalName || payload?.dasher?.formalNameAbbreviated || null,
    courierPhone: null,
    restaurantName: payload?.storeName || 'Restaurant',
    subtotal: summary.subtotal,
    subtotalAmount: summary.subtotalAmount,
    discountLabel: summary.discountLabel,
    discount: summary.discount,
    discountAmount: summary.discountAmount,
    total: summary.total,
    totalAmount: summary.totalAmount,
    netPayout: formatDoorDashPrice(payload?.orderTotal || payload?.subtotal || payload?.preTaxTotal),
    marketplaceFeeRate: null,
    fulfillmentType: payload?.fulfillmentType || 'DOORDASH',
    orderJobState: payload?.orderStatusDisplay || String(payload?.orderStatus || 'Completed'),
    statusDescription: payload?.orderExperience || 'DoorDash',
    checkoutInfo: [
      payload?.preTaxTotal ? { key: 'pre_tax_total', amount: formatDoorDashPrice(payload.preTaxTotal), label: 'Pre-tax total' } : null,
      payload?.subtotal ? { key: 'subtotal', amount: formatDoorDashPrice(payload.subtotal), label: 'Subtotal' } : null,
      payload?.orderTotal ? { key: 'order_total', amount: formatDoorDashPrice(payload.orderTotal), label: 'Order total' } : null,
    ].filter((entry): entry is { key: string; amount: string; label: string } => Boolean(entry)),
    orderStateChanges,
    items,
  };
}

async function fetchUberOrderDetail(cookieHeader: string, workflowUuid: string, mode: 'history' | 'live') {
  const restaurantUuid = extractSelectedRestaurantUuid(cookieHeader);
  if (!restaurantUuid) {
    throw new Error('Could not determine Uber Eats restaurant from saved cookies');
  }

  const isLive = mode === 'live';
  const body = isLive
    ? {
        operationName: 'LiveOrderDetails',
        variables: {
          workflowUUID: workflowUuid,
          metadata: {
            isEatsPassSubscriber: true,
            locale: 'en-AU',
          },
        },
        query: buildLiveOrderDetailsQuery(),
      }
    : {
        operationName: 'OrderDetails',
        variables: {
          workflowUUID: workflowUuid,
          metadata: {
            isEatsPassSubscriber: false,
            locale: 'en-GB',
          },
          shouldEnableChargebackComms: true,
          detailsRequestedByRestaurantUUID: restaurantUuid,
        },
        query: buildOrderDetailsQuery(),
      };

  const response = await fetch(`https://merchants.ubereats.com/manager/graphql?op=${isLive ? 'LiveOrderDetails' : 'OrderDetails'}`, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'accept-language': isLive ? 'en-AU,en-GB;q=0.9,en-US;q=0.8,en;q=0.7' : 'en-GB,en-US;q=0.9,en;q=0.8',
      'content-type': 'application/json',
      origin: 'https://merchants.ubereats.com',
      priority: 'u=1, i',
      referer: isLive
        ? `https://merchants.ubereats.com/manager/orders/active/${workflowUuid}?restaurantUUID=${restaurantUuid}&activeOrder=1&detailsRequestedByRestaurantUUID=${restaurantUuid}`
        : `https://merchants.ubereats.com/manager/orders/${workflowUuid}?restaurantUUID=${restaurantUuid}`,
      'sec-ch-ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      'x-csrf-token': 'x',
      Cookie: cookieHeader,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const text = await response.text();
  const payload = (() => {
    try {
      return JSON.parse(text) as UberOrderDetailsResponse;
    } catch {
      return null;
    }
  })();

  const details = isLive
    ? payload?.data?.liveOrderDetails
      ? {
          ...payload.data.liveOrderDetails,
          orderJobState: payload.data.liveOrderDetails.issueSummary?.orderJobState ?? null,
          statusDescription:
            payload.data.liveOrderDetails.issueSummary?.failureReason
            ?? payload.data.liveOrderDetails.issueSummary?.issueType
            ?? null,
        }
      : null
    : payload?.data?.orderDetails
      ? {
          ...payload.data.orderDetails,
          orderJobState: payload.data.orderDetails.issueSummaryV2?.orderJobState ?? null,
          statusDescription: payload.data.orderDetails.issueSummaryV2?.statusDescription ?? null,
        }
      : null;

  if (!response.ok || !details) {
    throw new Error(payload?.errors?.[0]?.message || text.slice(0, 200).trim() || `Uber Eats order detail request failed (${response.status})`);
  }

  return normalizeUberOrderDetails(details);
}

async function fetchDoorDashOrderDetail(
  cookieHeader: string,
  workflowUuid: string,
  providerConfig: Record<string, string | number | boolean | null>
) {
  const storeId = Number(providerConfig.storeId);
  if (!storeId) {
    throw new Error('DoorDash settings require storeId');
  }

  const ddAttKey = typeof providerConfig.ddAttKey === 'string' ? providerConfig.ddAttKey.trim() : '';
  const response = await fetch('https://merchant-portal.doordash.com/merchant-analytics-service/api/v1/orders_details/', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'accept-language': 'en-GB',
      'client-version': 'web version 2.0',
      'content-type': 'application/json',
      ...(ddAttKey ? { 'dd-att-key': ddAttKey } : {}),
      origin: 'https://www.doordash.com',
      'origin-app': 'merchant_portal',
      priority: 'u=1, i',
      referer: 'https://www.doordash.com/',
      'sec-ch-ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      country: 'AU',
      storeId,
      deliveryUuid: workflowUuid,
    }),
    cache: 'no-store',
  });

  const text = await response.text();
  const payload = (() => {
    try {
      return JSON.parse(text) as DoorDashDetailResponse;
    } catch {
      return null;
    }
  })();

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || text.slice(0, 200).trim() || `DoorDash order detail request failed (${response.status})`);
  }

  return normalizeDoorDashOrderDetails(payload.data);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateMarketplaceRequest(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { provider: rawProvider, workflowUuid } = await context.params;
    const provider = parseMarketplaceProvider(rawProvider);
    if (!provider) {
      return NextResponse.json({ success: false, error: 'Unsupported marketplace provider' }, { status: 400 });
    }
    if (!workflowUuid?.trim()) {
      return NextResponse.json({ success: false, error: 'workflowUuid is required' }, { status: 400 });
    }

    if (provider === 'uber_eats') {
      const url = new URL(request.url);
      const mode = url.searchParams.get('mode') === 'live' ? 'live' : 'history';
      const cookieHeader = await getMarketplaceCookies(provider);
      const result = await fetchUberOrderDetail(cookieHeader, workflowUuid.trim(), mode);
      return NextResponse.json({ success: true, data: result });
    }

    const { cookies, providerConfig } = await getMarketplaceCredentialBundle(provider);
    const result = await fetchDoorDashOrderDetail(cookies, workflowUuid.trim(), providerConfig);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
