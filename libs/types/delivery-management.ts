export interface DeliveryJobAddress {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postcode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  delivery_instructions?: string;
}

export interface DeliveryQuoteOption {
  id: string | null;
  provider: string;
  fee: number;
  currency: string;
  pickupAt: string | null;
  deliveryAt: string | null;
  pickupMinutes: number | null;
  deliveryMinutes: number | null;
}

export interface ShipdayDeliveryRecord {
  id: string;
  reference: string;
  status: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  createdAt: string | null;
  driverName: string | null;
  driverPhone: string | null;
  trackingUrl: string | null;
  deliveryFee: number | null;
  raw: Record<string, unknown>;
}

export interface ShipdayDeliveryPage {
  orders: ShipdayDeliveryRecord[];
  page: number;
  hasMore: boolean;
}

export interface ShipdayDeliveryDetail {
  order: ShipdayDeliveryRecord;
  onDemand: Record<string, unknown> | null;
  onDemandError?: string;
}

export type DeliveryRequestState = 'quoted' | 'creating' | 'created' | 'assigning' | 'requested'
  | 'needs_confirmation' | 'creation_uncertain' | 'assignment_uncertain' | 'failed';

export interface DeliveryRequest {
  id: string;
  reference: string;
  state: DeliveryRequestState;
  shipdayOrderId: string | null;
  orderId: string | null;
  quotes: DeliveryQuoteOption[];
  expiresAt: string;
  error: string | null;
  trackingUrl: string | null;
}

export interface DeliveryRecipient {
  name: string;
  phone: string;
  email?: string;
}
