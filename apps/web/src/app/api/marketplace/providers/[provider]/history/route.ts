import { NextResponse } from 'next/server';
import {
  authenticateMarketplaceRequest,
  getMarketplaceCookies,
  getMarketplaceCredentialBundle,
  parseMarketplaceProvider,
  type MarketplaceProvider,
} from '@/lib/marketplace-credentials';

type RouteContext = {
  params: Promise<{ provider: string }>;
};

type MarketplaceHistoryDateRange =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'LAST_12_WEEKS'
  | 'CUSTOM';

type UberHistoricOrder = {
  orderId: string;
  workflowUuid: string;
  orderUuid: string;
  salesTotal: string;
  netPayout: string;
  payout?: string;
  payoutAmount?: string;
  restaurantPayout?: string;
  restaurantNetPayout?: string;
  netPayoutAmount?: string;
  requestedAt: string;
  deliveryTimeLocal?: string;
  courierName: string;
  fulfillmentType: string;
  issueType: string;
  orderStatus?: string;
  orderChannel: string;
  eater?: {
    name?: string;
    isEatsPassSubscriber?: boolean;
    subscriptionPass?: string;
  };
};

type UberScheduledResponse = {
  data?: {
    ordersV2?: {
      rows?: UberHistoricOrder[];
      paginationResult?: {
        nextCursor?: string;
        nextTable?: string;
      };
      ordersCount?: number;
    };
  };
  errors?: Array<{ message?: string }>;
};

type DoorDashOrder = {
  orderId?: string;
  deliveryUuid?: string;
  pickupTime?: string;
  deliveryTime?: string;
  completedTime?: string;
  orderValue?: {
    displayString?: string;
  };
  consumer?: {
    informalName?: string;
    formalNameAbbreviated?: string;
  };
  dasher?: {
    informalName?: string;
    formalNameAbbreviated?: string;
  };
  experience?: string;
  orderStatusValue?: string;
  orderStatusDisplay?: string;
  orderSubStatus?: {
    value?: string;
    display?: string;
  };
  fulfillmentDetails?: {
    fulfillmentType?: string;
  };
};

function resolveHistoryNetPayout(order: UberHistoricOrder & Record<string, unknown>) {
  return order.netPayout
    || order.payout
    || order.payoutAmount
    || order.restaurantPayout
    || order.restaurantNetPayout
    || order.netPayoutAmount
    || '';
}

const AU_TIMEZONE = 'Australia/Melbourne';

function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value || '0'),
    month: Number(parts.find((part) => part.type === 'month')?.value || '0'),
    day: Number(parts.find((part) => part.type === 'day')?.value || '0'),
  };
}

function shiftDateParts(parts: { year: number; month: number; day: number }, dayOffset: number) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function parseHistoryDateRange(value: string | null): MarketplaceHistoryDateRange {
  switch (value) {
    case 'TODAY':
    case 'YESTERDAY':
    case 'THIS_WEEK':
    case 'THIS_MONTH':
    case 'LAST_7_DAYS':
    case 'LAST_30_DAYS':
    case 'LAST_12_WEEKS':
    case 'CUSTOM':
      return value;
    default:
      return 'TODAY';
  }
}

function getDateRangeParts(dateRange: MarketplaceHistoryDateRange) {
  const zonedToday = getZonedDateParts(new Date(), AU_TIMEZONE);
  let startParts = zonedToday;
  let endParts = zonedToday;

  if (dateRange === 'YESTERDAY') {
    startParts = shiftDateParts(zonedToday, -1);
    endParts = startParts;
  } else if (dateRange === 'THIS_WEEK') {
    const weekday = new Date(Date.UTC(zonedToday.year, zonedToday.month - 1, zonedToday.day)).getUTCDay();
    const offset = weekday === 0 ? 6 : weekday - 1;
    startParts = shiftDateParts(zonedToday, -offset);
  } else if (dateRange === 'THIS_MONTH') {
    startParts = { ...zonedToday, day: 1 };
  } else if (dateRange === 'LAST_7_DAYS') {
    startParts = shiftDateParts(zonedToday, -6);
  } else if (dateRange === 'LAST_30_DAYS') {
    startParts = shiftDateParts(zonedToday, -29);
  } else if (dateRange === 'LAST_12_WEEKS') {
    startParts = shiftDateParts(zonedToday, -83);
  }

  return { startParts, endParts };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return asUtc - date.getTime();
}

function zonedDateTimeToUtcIso(
  parts: { year: number; month: number; day: number },
  timeZone: string,
  endOfDay: boolean
) {
  const guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
  const offset = getTimeZoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess - offset).toISOString();
}

function extractSelectedRestaurantUuid(cookieHeader: string) {
  const match = cookieHeader.match(/(?:^|;\s*)selectedRestaurant=([^;]+)/);
  return match?.[1]?.trim() || null;
}

function buildUberHistoryPayload(cookieHeader: string, cursor?: string, dateRange: MarketplaceHistoryDateRange = 'TODAY') {
  const locationUuid = extractSelectedRestaurantUuid(cookieHeader);
  if (!locationUuid) {
    throw new Error('Could not determine Uber Eats restaurant from saved cookies');
  }

  const { startParts, endParts } = getDateRangeParts(dateRange);

  const payload: Record<string, unknown> = {
    filters: {
      currentTab: '',
      displayCurrencyCode: '',
      locationConstraints: {
        cities: [],
        countries: [],
        locationUuids: [locationUuid],
      },
      dateFilter: {
        startDate: `${String(startParts.year)}-${String(startParts.month).padStart(2, '0')}-${String(startParts.day).padStart(2, '0')} 00:00:00`,
        endDate: `${String(endParts.year)}-${String(endParts.month).padStart(2, '0')}-${String(endParts.day).padStart(2, '0')} 23:59:59`,
        lastUpdatedAt: '',
      },
      isEatsPassSubscriber: false,
      search: null,
      orderIssuesV2: [],
      issueOrderStatusFilter: [],
      displayByocIssues: false,
    },
    sort: {
      sortColumn: 'SORT_COLUMN_ORDER_COMPLETED_AT',
      sortDirection: 'SORT_DIRECTION_DESC',
    },
    pagingInfo: {
      cursor: cursor || '',
      limit: 20,
      nextTable: 'liveOrders',
    },
    pagination: {
      cursor: cursor || '',
      nextTable: 'historyOrders',
      limit: 20,
    },
  };

  return payload;
}

async function fetchUberHistory(cookieHeader: string, cursor?: string, dateRange: MarketplaceHistoryDateRange = 'TODAY') {
  const requestPayload = buildUberHistoryPayload(cookieHeader, cursor, dateRange);
  const response = await fetch('https://merchants.ubereats.com/manager/api/getHistoricOrders?localeCode=en-GB', {
    method: 'POST',
    headers: {
      accept: '*/*',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'content-type': 'application/json',
      origin: 'https://merchants.ubereats.com',
      priority: 'u=1, i',
      referer: `https://merchants.ubereats.com/manager/orders?dateRange=${dateRange.toLowerCase()}`,
      'sec-ch-ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      'x-csrf-token': 'x',
      'x-feature-flags': '{"featureKey":"OrdersList","isMobile":"false","isEmbedded":"false","userCohort":"MEMBERSHIP_LESS_THAN_500","pageName":"orders","operationMetricsUDLFlowEnabled":"true","isUEMOperationMetricsConsistencyEnabled":"true"}',
      Cookie: cookieHeader,
    },
    body: JSON.stringify(requestPayload),
    cache: 'no-store',
  });

  const responseText = await response.text();
  const payload = (() => {
    try {
      return JSON.parse(responseText) as {
        status?: string;
        data?: {
          orders?: UberHistoricOrder[];
          pagination?: { cursor?: string };
          paginationResult?: { nextCursor?: string; nextTable?: string };
        };
        message?: string;
      };
    } catch {
      return null;
    }
  })();

  if (!response.ok || payload?.status !== 'success') {
    throw new Error(payload?.message || responseText.slice(0, 200).trim() || `Uber Eats history request failed (${response.status})`);
  }

  const rawOrders = payload.data?.orders || [];
  const orders = rawOrders.map((order) => ({
    orderId: order.orderId,
    workflowUuid: order.workflowUuid,
    orderUuid: order.orderUuid,
    customerName: order.eater?.name || 'Customer',
    salesTotal: order.salesTotal,
    netPayout: resolveHistoryNetPayout(order as UberHistoricOrder & Record<string, unknown>),
    requestedAt: order.requestedAt,
    courierName: order.courierName || '',
    fulfillmentType: order.fulfillmentType,
    issueType: order.issueType || '',
    orderChannel: order.orderChannel,
    isSubscriber: Boolean(order.eater?.isEatsPassSubscriber),
    subscriptionPass: order.eater?.subscriptionPass || '',
  }));
  return {
    provider: 'uber_eats' as MarketplaceProvider,
    orders,
    nextCursor: payload.data?.paginationResult?.nextCursor || payload.data?.pagination?.cursor || null,
  };
}

function buildUberScheduledQuery() {
  return `query ordersV2($filters: Orders_OrdersFiltersInput!, $pagination: Orders_OrdersPaginationInput, $shouldEnableChargebackComms: Boolean, $operationMetricsUDLFlowEnabled: Boolean) {
  ordersV2(
    filters: $filters
    pagination: $pagination
    shouldEnableChargebackComms: $shouldEnableChargebackComms
    operationMetricsUDLFlowEnabled: $operationMetricsUDLFlowEnabled
  ) {
    rows {
      orderId
      workflowUuid
      currencyCode
      restaurant {
        uuid
        name
        countryCode
      }
      eater {
        uuid
        name
        profileURL
        numOrders
        isEatsPassSubscriber
        subscriptionPass
      }
      orderTag
      orderStatus
      orderChannel
      fulfillmentType
      chargebackTotal
      salesTotal
      requestedAt
      netPayout
      canceledBy
      missedBy
      orderUuid
      courierName
      deliveryTimeLocal
      readyByTimeLocal
      issueType
      itemIssueType
      customizationIssueType
      chargebackIssuedAt
    }
    paginationResult {
      nextCursor
      nextTable
    }
    ordersCount
  }
}`;
}

function buildUberScheduledPayload(cookieHeader: string, dateRange: MarketplaceHistoryDateRange, cursor?: string) {
  const locationUuid = extractSelectedRestaurantUuid(cookieHeader);
  if (!locationUuid) {
    throw new Error('Could not determine Uber Eats restaurant from saved cookies');
  }

  const { startParts, endParts } = getDateRangeParts(dateRange);

  return {
    operationName: 'ordersV2',
    variables: {
      filters: {
        orderStatusFilter: [],
        search: '',
        dateRange: {
          start: `${String(startParts.year)}-${String(startParts.month).padStart(2, '0')}-${String(startParts.day).padStart(2, '0')}`,
          end: `${String(endParts.year)}-${String(endParts.month).padStart(2, '0')}-${String(endParts.day).padStart(2, '0')}`,
        },
        locationConstraints: {
          cities: [],
          countries: [],
          locationUUIDs: [locationUuid],
        },
        displayCurrencyCode: 'AUD',
        currentTab: 'scheduledOrders',
      },
      pagination: {
        limit: 20,
        cursor: cursor || '',
        nextTable: 'liveOrders',
      },
    },
    query: buildUberScheduledQuery(),
  };
}

async function fetchUberScheduled(cookieHeader: string, dateRange: MarketplaceHistoryDateRange = 'TODAY', cursor?: string) {
  const requestPayload = buildUberScheduledPayload(cookieHeader, dateRange, cursor);
  const response = await fetch('https://merchants.ubereats.com/manager/graphql?op=ordersV2', {
    method: 'POST',
    headers: {
      accept: '*/*',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'content-type': 'application/json',
      origin: 'https://merchants.ubereats.com',
      priority: 'u=1, i',
      referer: 'https://merchants.ubereats.com/manager/orders/scheduled',
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
    body: JSON.stringify(requestPayload),
    cache: 'no-store',
  });

  const responseText = await response.text();
  const payload = (() => {
    try {
      return JSON.parse(responseText) as UberScheduledResponse;
    } catch {
      return null;
    }
  })();

  const rows = payload?.data?.ordersV2?.rows || [];
  if (!response.ok || !payload?.data?.ordersV2) {
    throw new Error(payload?.errors?.[0]?.message || responseText.slice(0, 200).trim() || `Uber Eats scheduled request failed (${response.status})`);
  }

  return {
    provider: 'uber_eats' as MarketplaceProvider,
    orders: rows.map((order) => ({
      orderId: order.orderId,
      workflowUuid: order.workflowUuid,
      orderUuid: order.orderUuid,
      customerName: order.eater?.name || 'Customer',
      salesTotal: order.salesTotal,
      netPayout: resolveHistoryNetPayout(order as UberHistoricOrder & Record<string, unknown>),
      requestedAt: order.deliveryTimeLocal || order.requestedAt,
      courierName: order.courierName || '',
      fulfillmentType: order.fulfillmentType,
      issueType: order.issueType || order.orderStatus || 'Scheduled',
      orderChannel: order.orderChannel,
      isSubscriber: Boolean(order.eater?.isEatsPassSubscriber),
      subscriptionPass: order.eater?.subscriptionPass || '',
    })).filter((order) => order.orderId && order.workflowUuid),
    nextCursor: payload.data.ordersV2.paginationResult?.nextCursor || null,
  };
}

function buildDoorDashHistoryPayload(
  providerConfig: Record<string, string | number | boolean | null>,
  dateRange: MarketplaceHistoryDateRange,
  statuses: string[],
  mode: 'history' | 'scheduled'
) {
  const businessId = Number(providerConfig.businessId);
  const storeId = Number(providerConfig.storeId);
  if (!businessId || !storeId) {
    throw new Error('DoorDash settings require both businessId and storeId');
  }

  const { startParts, endParts } = getDateRangeParts(dateRange);

  return {
    businessIds: [businessId],
    organizations: [],
    storeIds: [storeId],
    type: mode === 'scheduled' ? 'scheduled' : 'history',
    statuses: mode === 'scheduled'
      ? ['SCHEDULED_DELIVERY_ORDER', 'SCHEDULED_PICKUP_ORDER']
      : statuses,
    subStatuses: [],
    dateGte: zonedDateTimeToUtcIso(startParts, AU_TIMEZONE, false),
    dateLt: zonedDateTimeToUtcIso(endParts, AU_TIMEZONE, true),
    limit: 20,
  };
}

async function fetchDoorDashHistory(
  cookieHeader: string,
  providerConfig: Record<string, string | number | boolean | null>,
  dateRange: MarketplaceHistoryDateRange,
  statuses: string[],
  mode: 'history' | 'scheduled'
) {
  const requestPayload = buildDoorDashHistoryPayload(providerConfig, dateRange, statuses, mode);
  const response = await fetch('https://merchant-portal.doordash.com/merchant-analytics-service/api/v1/get_orders', {
    method: 'POST',
    headers: {
      accept: '*/*',
      'accept-language': 'en-GB',
      'content-type': 'application/json',
      origin: 'https://www.doordash.com',
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
    body: JSON.stringify(requestPayload),
    cache: 'no-store',
  });

  const responseText = await response.text();
  const payload = (() => {
    try {
      return JSON.parse(responseText) as { orders?: DoorDashOrder[]; message?: string };
    } catch {
      return null;
    }
  })();

  if (!response.ok || !payload?.orders) {
    throw new Error(payload?.message || responseText.slice(0, 200).trim() || `DoorDash ${mode} request failed (${response.status})`);
  }

  return {
    provider: 'doordash' as MarketplaceProvider,
    orders: payload.orders.map((order) => ({
      orderId: order.orderId || '',
      workflowUuid: order.deliveryUuid || '',
      orderUuid: order.deliveryUuid || '',
      customerName: order.consumer?.informalName || order.consumer?.formalNameAbbreviated || 'Customer',
      salesTotal: order.orderValue?.displayString || '',
      netPayout: '',
      requestedAt: mode === 'scheduled'
        ? order.deliveryTime || order.pickupTime || order.completedTime || ''
        : order.completedTime || order.deliveryTime || order.pickupTime || '',
      courierName: order.dasher?.informalName || order.dasher?.formalNameAbbreviated || '',
      fulfillmentType: order.fulfillmentDetails?.fulfillmentType || '',
      issueType: order.orderStatusDisplay || '',
      orderChannel: order.orderSubStatus?.display || 'DoorDash',
      isSubscriber: false,
      subscriptionPass: '',
    })).filter((order) => order.orderId && order.workflowUuid),
    nextCursor: null,
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateMarketplaceRequest(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { provider: rawProvider } = await context.params;
    const provider = parseMarketplaceProvider(rawProvider);
    if (!provider) {
      return NextResponse.json({ success: false, error: 'Unsupported marketplace provider' }, { status: 400 });
    }

    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor')?.trim() || undefined;
    const dateRange = parseHistoryDateRange(url.searchParams.get('dateRange'));
    const mode = url.searchParams.get('mode') === 'scheduled' ? 'scheduled' : 'history';
    const statuses = (url.searchParams.get('statuses') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (provider === 'uber_eats') {
      const cookieHeader = await getMarketplaceCookies(provider);
      const result = mode === 'scheduled'
        ? await fetchUberScheduled(cookieHeader, dateRange, cursor)
        : await fetchUberHistory(cookieHeader, cursor, dateRange);
      return NextResponse.json({ success: true, data: result });
    }

    const { cookies, providerConfig } = await getMarketplaceCredentialBundle(provider);
    const result = await fetchDoorDashHistory(cookies, providerConfig, dateRange, statuses, mode);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
