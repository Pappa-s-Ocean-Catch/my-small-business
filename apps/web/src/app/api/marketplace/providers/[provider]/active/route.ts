import { NextResponse } from 'next/server';
import { createMarketplaceProviderClient } from '@my-small-business/marketplace';
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

type UberActiveOrder = {
  orderId?: string;
  workflowUuid?: string;
  workflowUUID?: string;
  orderUuid?: string;
  orderUUID?: string;
  salesTotal?: string;
  requestedAt?: string;
  deliveryTimeLocal?: string;
  estimatedReadyTimeLocal?: string;
  courierName?: string;
  fulfillmentType?: string;
  orderChannel?: string;
  eater?: {
    name?: string;
  };
  customer?: {
    name?: string;
  };
  issueType?: string;
  orderTag?: string;
  orderCategory?: string;
};

type UberActiveResponse = {
  status?: string;
  data?: {
    rows?: UberActiveOrder[];
    orders?: UberActiveOrder[];
    activeOrders?: UberActiveOrder[];
    paginationResult?: {
      nextCursor?: string;
    };
    pagination?: {
      cursor?: string;
      nextCursor?: string;
    };
  };
  message?: string;
};

type DoorDashActiveOrder = {
  orderId?: string;
  deliveryUuid?: string;
  pickupTime?: string;
  deliveryTime?: string;
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
  orderStatusDisplay?: string;
  orderSubStatus?: {
    display?: string;
  };
  fulfillmentDetails?: {
    fulfillmentType?: string;
  };
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

  const rawOrders = payload?.data?.rows || payload?.data?.orders || payload?.data?.activeOrders || [];
  if (!response.ok || payload?.status !== 'success') {
    throw new Error(payload?.message || responseText.slice(0, 200).trim() || `Uber Eats active orders request failed (${response.status})`);
  }

  return {
    provider: 'uber_eats' as MarketplaceProvider,
    orders: rawOrders
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
        status: order.orderTag || order.orderCategory || order.issueType || 'Active',
        statusDescription: order.deliveryTimeLocal || order.estimatedReadyTimeLocal || '',
      }))
      .filter((order) => order.orderId && order.workflowUuid),
    nextCursor: payload?.data?.paginationResult?.nextCursor || payload?.data?.pagination?.nextCursor || payload?.data?.pagination?.cursor || null,
  };
}

function buildDoorDashActivePayload(providerConfig: Record<string, string | number | boolean | null>) {
  const businessId = Number(providerConfig.businessId);
  const storeId = Number(providerConfig.storeId);
  if (!businessId || !storeId) {
    throw new Error('DoorDash settings require both businessId and storeId');
  }

  return {
    businessIds: [businessId],
    organizations: [],
    storeIds: [storeId],
    type: 'active',
    statuses: [],
    subStatuses: [],
    limit: 20,
  };
}

async function fetchDoorDashActiveOrders(
  cookieHeader: string,
  providerConfig: Record<string, string | number | boolean | null>
) {
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
    body: JSON.stringify(buildDoorDashActivePayload(providerConfig)),
    cache: 'no-store',
  });

  const responseText = await response.text();
  const payload = (() => {
    try {
      return JSON.parse(responseText) as { orders?: DoorDashActiveOrder[]; message?: string };
    } catch {
      return null;
    }
  })();

  if (!response.ok || !payload?.orders) {
    throw new Error(payload?.message || responseText.slice(0, 200).trim() || `DoorDash active orders request failed (${response.status})`);
  }

  return {
    provider: 'doordash' as MarketplaceProvider,
    orders: payload.orders.map((order) => ({
      orderId: order.orderId || '',
      workflowUuid: order.deliveryUuid || '',
      orderUuid: order.deliveryUuid || '',
      customerName: order.consumer?.informalName || order.consumer?.formalNameAbbreviated || 'Customer',
      salesTotal: order.orderValue?.displayString || '',
      requestedAt: order.pickupTime || order.deliveryTime || '',
      courierName: order.dasher?.informalName || order.dasher?.formalNameAbbreviated || '',
      fulfillmentType: order.fulfillmentDetails?.fulfillmentType || '',
      orderChannel: 'DoorDash',
      status: order.orderStatusDisplay || 'Active',
      statusDescription: order.orderSubStatus?.display || '',
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

    const client = createMarketplaceProviderClient({
      getSession: async (requestedProvider) => {
        const { cookies, providerConfig } = await getMarketplaceCredentialBundle(requestedProvider);
        return { provider: requestedProvider, cookies, providerConfig, updatedAt: null };
      },
    });
    const result = await client.getActiveOrders(provider, cursor);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
