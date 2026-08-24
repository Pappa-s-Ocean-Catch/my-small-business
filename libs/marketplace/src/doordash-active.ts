import type { MarketplaceProviderConfig } from './contracts';

type DoorDashActiveOrder = {
  orderId?: string;
  deliveryUuid?: string;
  pickupTime?: string;
  deliveryTime?: string;
  orderValue?: { displayString?: string };
  consumer?: { informalName?: string; formalNameAbbreviated?: string };
  dasher?: { informalName?: string; formalNameAbbreviated?: string };
  orderStatusDisplay?: string;
  orderSubStatus?: { display?: string };
  fulfillmentDetails?: { fulfillmentType?: string };
};

export function buildDoorDashActivePayload(providerConfig: MarketplaceProviderConfig) {
  const businessId = Number(providerConfig.businessId);
  const storeId = Number(providerConfig.storeId);
  if (!businessId || !storeId) throw new Error('DoorDash settings require both businessId and storeId');
  return { businessIds: [businessId], organizations: [], storeIds: [storeId], type: 'active', statuses: [], subStatuses: [], limit: 20 };
}

export function normalizeDoorDashActiveOrders(rows: DoorDashActiveOrder[]) {
  return rows.map((order) => ({
    orderId: order.orderId || '', workflowUuid: order.deliveryUuid || '', orderUuid: order.deliveryUuid || '', customerName: order.consumer?.informalName || order.consumer?.formalNameAbbreviated || 'Customer', salesTotal: order.orderValue?.displayString || '', requestedAt: order.pickupTime || order.deliveryTime || '', courierName: order.dasher?.informalName || order.dasher?.formalNameAbbreviated || '', fulfillmentType: order.fulfillmentDetails?.fulfillmentType || '', orderChannel: 'DoorDash', status: order.orderStatusDisplay || 'Active', statusDescription: order.orderSubStatus?.display || '',
  })).filter((order) => order.orderId && order.workflowUuid);
}
