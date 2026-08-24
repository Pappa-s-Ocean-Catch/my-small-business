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
  orderTag?: string;
  orderCategory?: string;
  issueType?: string;
  eater?: { name?: string };
  customer?: { name?: string };
};

function selectedRestaurant(cookieHeader: string) {
  return cookieHeader.match(/(?:^|;\s*)selectedRestaurant=([^;]+)/)?.[1]?.trim() || null;
}

export function buildUberActivePayload(cookieHeader: string, cursor?: string) {
  const locationUuid = selectedRestaurant(cookieHeader);
  if (!locationUuid) throw new Error('Could not determine Uber Eats restaurant from saved cookies');
  return { filters: { currentTab: 'activeOrders', displayCurrencyCode: 'AUD', isEatsPassSubscriber: false, locationConstraints: { cities: [], countries: [], locationUuids: [locationUuid] }, orderIssuesV2: [], issueOrderStatusFilter: [], search: '', displayByocIssues: false }, pagination: { limit: 20, cursor: cursor || '', nextTable: '' }, sort: { sortColumn: null, sortDirection: null } };
}

export function normalizeUberActiveOrders(rows: UberActiveOrder[]) {
  return rows.map((order) => ({
    orderId: order.orderId || '', workflowUuid: order.workflowUuid || order.workflowUUID || '', orderUuid: order.orderUuid || order.orderUUID || '',
    customerName: order.eater?.name || order.customer?.name || 'Customer', salesTotal: order.salesTotal || '', requestedAt: order.requestedAt || '', courierName: order.courierName || '', fulfillmentType: order.fulfillmentType || '', orderChannel: order.orderChannel || '', status: order.orderTag || order.orderCategory || order.issueType || 'Active', statusDescription: order.deliveryTimeLocal || order.estimatedReadyTimeLocal || '',
  })).filter((order) => order.orderId && order.workflowUuid);
}
