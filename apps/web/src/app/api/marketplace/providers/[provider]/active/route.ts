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

type UberActiveOrder = {
  orderId?: string;
  workflowUuid?: string;
  workflowUUID?: string;
  orderUuid?: string;
  orderUUID?: string;
  salesTotal?: string;
  requestedAt?: string;
  courierName?: string;
  fulfillmentType?: string;
  orderChannel?: string;
  eater?: {
    name?: string;
  };
  customer?: {
    name?: string;
  };
  issueSummaryV2?: {
    orderJobState?: string | null;
    statusDescription?: string | null;
  };
  orderState?: string | null;
  status?: string | null;
  statusDescription?: string | null;
};

type UberActiveResponse = {
  status?: string;
  data?: {
    orders?: UberActiveOrder[];
    activeOrders?: UberActiveOrder[];
    pagination?: {
      cursor?: string;
      nextCursor?: string;
    };
  };
  message?: string;
};

function extractSelectedRestaurantUuid(cookieHeader: string) {
  const match = cookieHeader.match(/(?:^|;\s*)selectedRestaurant=([^;]+)/);
  return match?.[1]?.trim() || null;
}

function buildUberActivePayload(cookieHeader: string, cursor?: string) {
  const locationUuid = extractSelectedRestaurantUuid(cookieHeader);
  if (!locationUuid) {
    throw new Error('Could not determine Uber Eats restaurant from saved cookies');
  }

  return {
    filters: {
      currentTab: 'activeOrders',
      displayCurrencyCode: 'AUD',
      isEatsPassSubscriber: false,
      locationConstraints: {
        cities: [],
        countries: [],
        locationUuids: [locationUuid],
      },
      orderIssuesV2: [],
      issueOrderStatusFilter: [],
      search: '',
      displayByocIssues: false,
    },
    pagination: {
      limit: 20,
      cursor: cursor || '',
      nextTable: '',
    },
    sort: {
      sortColumn: null,
      sortDirection: null,
    },
  };
}

async function fetchUberActiveOrders(cookieHeader: string, cursor?: string) {
  const response = await fetch('https://merchants.ubereats.com/manager/api/getActiveOrders?localeCode=en-AU', {
    method: 'POST',
    headers: {
      accept: '*/*',
      'accept-language': 'en-AU,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
      'content-type': 'application/json',
      origin: 'https://merchants.ubereats.com',
      priority: 'u=1, i',
      referer: 'https://merchants.ubereats.com/manager/orders/active?dateRange=this_week',
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
    body: JSON.stringify(buildUberActivePayload(cookieHeader, cursor)),
    cache: 'no-store',
  });

  const responseText = await response.text();
  const payload = (() => {
    try {
      return JSON.parse(responseText) as UberActiveResponse;
    } catch {
      return null;
    }
  })();

  const rawOrders = payload?.data?.orders || payload?.data?.activeOrders || [];
  if (!response.ok || payload?.status !== 'success') {
    throw new Error(payload?.message || responseText.slice(0, 200).trim() || `Uber Eats active orders request failed (${response.status})`);
  }

  const orders = rawOrders
    .map((order) => ({
      orderId: order.orderId || '',
      workflowUuid: order.workflowUuid || order.workflowUUID || '',
      orderUuid: order.orderUuid || order.orderUUID || '',
      customerName: order.eater?.name || order.customer?.name || 'Customer',
      salesTotal: order.salesTotal || '',
      requestedAt: order.requestedAt || '',
      courierName: order.courierName || '',
      fulfillmentType: order.fulfillmentType || '',
      orderChannel: order.orderChannel || '',
      status: order.issueSummaryV2?.orderJobState || order.orderState || order.status || 'Unknown',
      statusDescription: order.issueSummaryV2?.statusDescription || order.statusDescription || '',
    }))
    .filter((order) => order.orderId && order.workflowUuid);

  return {
    provider: 'uber_eats' as MarketplaceProvider,
    orders,
    nextCursor: payload?.data?.pagination?.cursor || payload?.data?.pagination?.nextCursor || null,
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
      return NextResponse.json({ success: false, error: 'Active order sync is not implemented for this provider yet' }, { status: 400 });
    }

    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor')?.trim() || undefined;
    const cookieHeader = await getMarketplaceCookies(provider);
    const result = await fetchUberActiveOrders(cookieHeader, cursor);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
