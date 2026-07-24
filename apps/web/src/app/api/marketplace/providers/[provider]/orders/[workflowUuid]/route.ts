import { NextResponse } from 'next/server';
import {
  authenticateMarketplaceRequest,
  getMarketplaceCookies,
  parseMarketplaceProvider,
} from '@/lib/marketplace-credentials';

type RouteContext = {
  params: Promise<{ provider: string; workflowUuid: string }>;
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
      items?: Array<{
        name: string;
        price: string;
        quantity: number;
        specialInstructions?: string | null;
        customizations?: Array<{
          name: string;
          options?: Array<{
            name: string;
            quantity: number;
            price?: string | null;
          }>;
        }>;
      }>;
    };
  };
  errors?: Array<{ message?: string }>;
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

async function fetchUberOrderDetail(cookieHeader: string, workflowUuid: string) {
  const restaurantUuid = extractSelectedRestaurantUuid(cookieHeader);
  if (!restaurantUuid) {
    throw new Error('Could not determine Uber Eats restaurant from saved cookies');
  }

  const body = {
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

  const response = await fetch('https://merchants.ubereats.com/manager/graphql?op=OrderDetails', {
    method: 'POST',
    headers: {
      accept: '*/*',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'content-type': 'application/json',
      origin: 'https://merchants.ubereats.com',
      priority: 'u=1, i',
      referer: `https://merchants.ubereats.com/manager/orders/${workflowUuid}?restaurantUUID=${restaurantUuid}`,
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

  const details = payload?.data?.orderDetails;
  if (!response.ok || !details) {
    throw new Error(payload?.errors?.[0]?.message || text.slice(0, 200).trim() || `Uber Eats order detail request failed (${response.status})`);
  }

  return {
    orderId: details.orderId,
    orderUUID: details.orderUUID,
    requestedAt: details.requestedAt,
    completedAtTimestamp: details.completedAtTimestamp ?? null,
    customerName: details.eater?.name || 'Customer',
    customerPhone: details.eater?.phone ?? null,
    customerAddress: details.eater?.deliveryAddress ?? null,
    courierName: details.courier?.name ?? null,
    courierPhone: details.courier?.phone ?? null,
    restaurantName: details.restaurant?.name || 'Restaurant',
    netPayout: details.netPayout,
    marketplaceFeeRate: details.marketplaceFeeRate ?? null,
    fulfillmentType: details.fulfillmentType,
    orderJobState: details.issueSummaryV2?.orderJobState ?? null,
    statusDescription: details.issueSummaryV2?.statusDescription ?? null,
    checkoutInfo: (details.checkoutInfo || []).map((entry) => ({
      key: entry.key,
      amount: entry.amount,
      label: entry.label,
    })),
    orderStateChanges: (details.orderStateChanges || []).map((entry) => ({
      changedAt: entry.changedAt,
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
    if (provider !== 'uber_eats') {
      return NextResponse.json({ success: false, error: 'Order details are not implemented for this provider yet' }, { status: 400 });
    }
    if (!workflowUuid?.trim()) {
      return NextResponse.json({ success: false, error: 'workflowUuid is required' }, { status: 400 });
    }

    const cookieHeader = await getMarketplaceCookies(provider);
    const result = await fetchUberOrderDetail(cookieHeader, workflowUuid.trim());
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
