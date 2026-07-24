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

type UberHistoricOrder = {
  orderId: string;
  workflowUuid: string;
  orderUuid: string;
  salesTotal: string;
  netPayout: string;
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

function formatUberDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function extractSelectedRestaurantUuid(cookieHeader: string) {
  const match = cookieHeader.match(/(?:^|;\s*)selectedRestaurant=([^;]+)/);
  return match?.[1]?.trim() || null;
}

function buildUberHistoryPayload(cookieHeader: string, cursor?: string) {
  const locationUuid = extractSelectedRestaurantUuid(cookieHeader);
  if (!locationUuid) {
    throw new Error('Could not determine Uber Eats restaurant from saved cookies');
  }

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

  return {
    filters: {
      currentTab: '',
      displayCurrencyCode: '',
      locationConstraints: {
        cities: [],
        countries: [],
        locationUuids: [locationUuid],
      },
      dateFilter: {
        startDate: formatUberDate(startDate),
        endDate: formatUberDate(endDate),
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
      cursor: '',
      limit: 20,
      nextTable: 'liveOrders',
    },
    pagination: {
      cursor: cursor || '',
      nextTable: 'historyOrders',
      limit: 20,
    },
  };
}

async function fetchUberHistory(cookieHeader: string, cursor?: string) {
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
    body: JSON.stringify(buildUberHistoryPayload(cookieHeader, cursor)),
    cache: 'no-store',
  });

  const responseText = await response.text();
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
    netPayout: order.netPayout,
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
    const cookieHeader = await getMarketplaceCookies(provider);
    const result = await fetchUberHistory(cookieHeader, cursor);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
