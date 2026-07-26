import { NextResponse } from 'next/server';
import {
  authenticateMarketplaceRequest,
  getMarketplaceCookies,
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
  courierName: string;
  fulfillmentType: string;
  issueType: string;
  orderChannel: string;
  eater?: {
    name?: string;
    isEatsPassSubscriber?: boolean;
    subscriptionPass?: string;
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

function formatUberDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const UBER_HISTORY_TIMEZONE = 'Australia/Melbourne';

function extractSelectedRestaurantUuid(cookieHeader: string) {
  const match = cookieHeader.match(/(?:^|;\s*)selectedRestaurant=([^;]+)/);
  return match?.[1]?.trim() || null;
}

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

function formatPartsDate(parts: { year: number; month: number; day: number }, time: 'start' | 'end') {
  const year = String(parts.year);
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${year}-${month}-${day} ${time === 'start' ? '00:00:00' : '23:59:59'}`;
}

function getDateRangeBounds(dateRange: MarketplaceHistoryDateRange) {
  const zonedToday = getZonedDateParts(new Date(), UBER_HISTORY_TIMEZONE);
  const endDate = formatPartsDate(zonedToday, 'end');
  let startParts = zonedToday;
  let endValue = dateRange === 'TODAY' ? formatPartsDate(zonedToday, 'end') : endDate;

  if (dateRange === 'TODAY') {
    return {
      startDate: formatPartsDate(zonedToday, 'start'),
      endDate: endValue,
    };
  }

  if (dateRange === 'YESTERDAY') {
    startParts = shiftDateParts(zonedToday, -1);
    endValue = formatPartsDate(startParts, 'end');
    return { startDate: formatPartsDate(startParts, 'start'), endDate: endValue };
  }

  if (dateRange === 'THIS_WEEK') {
    const weekday = new Date(Date.UTC(zonedToday.year, zonedToday.month - 1, zonedToday.day)).getUTCDay();
    const offset = weekday === 0 ? 6 : weekday - 1;
    startParts = shiftDateParts(zonedToday, -offset);
    return { startDate: formatPartsDate(startParts, 'start'), endDate: endValue };
  }

  if (dateRange === 'THIS_MONTH') {
    startParts = { ...zonedToday, day: 1 };
    return { startDate: formatPartsDate(startParts, 'start'), endDate: endValue };
  }

  if (dateRange === 'LAST_7_DAYS') {
    startParts = shiftDateParts(zonedToday, -6);
    return { startDate: formatPartsDate(startParts, 'start'), endDate: endValue };
  }

  if (dateRange === 'LAST_30_DAYS') {
    startParts = shiftDateParts(zonedToday, -29);
    return { startDate: formatPartsDate(startParts, 'start'), endDate: endValue };
  }

  startParts = shiftDateParts(zonedToday, -(7 * 12));
  return { startDate: formatPartsDate(startParts, 'start'), endDate: endValue };
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

function buildUberHistoryPayload(cookieHeader: string, cursor?: string, dateRange: MarketplaceHistoryDateRange = 'TODAY') {
  const locationUuid = extractSelectedRestaurantUuid(cookieHeader);
  if (!locationUuid) {
    throw new Error('Could not determine Uber Eats restaurant from saved cookies');
  }

  const { startDate, endDate } = getDateRangeBounds(dateRange);

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
        startDate,
        endDate,
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
  };

  if (cursor) {
    payload.pagination = {
      cursor,
      nextTable: 'historyOrders',
      limit: 20,
    };
  }

  return payload;
}

async function fetchUberHistory(cookieHeader: string, cursor?: string, dateRange: MarketplaceHistoryDateRange = 'TODAY') {
  const requestPayload = buildUberHistoryPayload(cookieHeader, cursor, dateRange);
  console.log('[marketplace][uber_eats][history] request', {
    dateRange,
    cursor: cursor || null,
    payload: requestPayload,
  });
  console.log('[marketplace][uber_eats][history] request-json\n' + JSON.stringify(requestPayload, null, 2));

  const response = await fetch('https://merchants.ubereats.com/manager/api/getHistoricOrders?localeCode=en-GB', {
    method: 'POST',
    headers: {
      accept: '*/*',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'content-type': 'application/json',
      origin: 'https://merchants.ubereats.com',
      priority: 'u=1, i',
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
  console.log('[marketplace][uber_eats][history] raw-response', {
    status: response.status,
    ok: response.ok,
    bodyPreview: responseText.slice(0, 2000),
  });

  const payload = (() => {
    try {
      return JSON.parse(responseText) as {
        status?: string;
        data?: { orders?: UberHistoricOrder[]; pagination?: { cursor?: string } };
        message?: string;
      };
    } catch {
      return null;
    }
  })() as {
    status?: string;
    data?: { orders?: UberHistoricOrder[]; pagination?: { cursor?: string } };
    message?: string;
  } | null;

  console.log('[marketplace][uber_eats][history] parsed-response', {
    uberStatus: payload?.status ?? null,
    message: payload?.message ?? null,
    orderCount: payload?.data?.orders?.length ?? 0,
    nextCursor: payload?.data?.pagination?.cursor ?? null,
    firstOrderPreview: payload?.data?.orders?.[0]
      ? {
          orderId: payload.data.orders[0].orderId,
          salesTotal: payload.data.orders[0].salesTotal,
          netPayout: payload.data.orders[0].netPayout,
          payout: (payload.data.orders[0] as Record<string, unknown>).payout ?? null,
          payoutAmount: (payload.data.orders[0] as Record<string, unknown>).payoutAmount ?? null,
          restaurantPayout: (payload.data.orders[0] as Record<string, unknown>).restaurantPayout ?? null,
          restaurantNetPayout: (payload.data.orders[0] as Record<string, unknown>).restaurantNetPayout ?? null,
          netPayoutAmount: (payload.data.orders[0] as Record<string, unknown>).netPayoutAmount ?? null,
        }
      : null,
  });

  if (!response.ok || payload?.status !== 'success') {
    const fallbackDetails = responseText.slice(0, 200).trim();
    throw new Error(
      payload?.message
      || fallbackDetails
      || `Uber Eats history request failed (${response.status})`
    );
  }

  const orders = (payload.data?.orders || []).map((order) => ({
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
    nextCursor: payload.data?.pagination?.cursor || null,
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

    if (provider !== 'uber_eats') {
      return NextResponse.json({ success: false, error: 'History sync is not implemented for this provider yet' }, { status: 400 });
    }

    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor')?.trim() || undefined;
    const dateRange = parseHistoryDateRange(url.searchParams.get('dateRange'));
    const cookieHeader = await getMarketplaceCookies(provider);
    const result = await fetchUberHistory(cookieHeader, cursor, dateRange);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
