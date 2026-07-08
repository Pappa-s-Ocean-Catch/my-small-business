// @ts-ignore
import Shipday from 'shipday';

export interface DeliveryAddress {
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  postcode: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DeliveryQuote {
  quote_id: string;
  fee: number;
  currency: string;
  expires_at?: string | null;
  estimated_duration_seconds?: number;
  estimated_duration_minutes?: number;
  distance_km?: number;
}

export interface CreateDeliveryRequest {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string; // Shipday takes full address string or components
  delivery_city?: string;
  delivery_state?: string;
  delivery_postcode?: string;
  pickup_address?: string;
  external_order_id?: string;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  items?: Array<{
    name: string;
    quantity: number;
    unit_price?: number;
    add_ons?: string[];
    detail?: string;
  }>;
  subtotal?: number;
  total_amount?: number;
  tax?: number;
  discount_amount?: number;
  delivery_fee?: number;
  tips?: number;
  payment_method?: 'online' | 'store';
  placed_at?: string;
  expected_pickup_at?: string;
  expected_delivery_at?: string;
  special_instructions?: string;
  assign_driver?: boolean;
}

export interface MarkDeliveryReadyRequest {
  delivery_id: string;
}

export interface CreateDeliveryResponse {
  delivery_id: string;
  order_number: string;
  status: string;
  tracking_url?: string;
  raw?: any;
}

class ShipdayClient {
  private sdk: any;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // Initialize the Shipday SDK with the API key and a 10s timeout as suggested
    this.sdk = new Shipday(apiKey, 10000);
  }


  /**
   * Shipday doesn't have a direct "pre-order" quote API.
   * We use the on-demand availability API and return the cheapest valid option.
   */
  async requestQuote(pickup: DeliveryAddress, dropoff: DeliveryAddress): Promise<DeliveryQuote> {
    const pickupStr = [pickup.address_line1, pickup.city, pickup.state, pickup.postcode].filter(Boolean).join(', ');
    const dropoffStr = [dropoff.address_line1, dropoff.city, dropoff.state, dropoff.postcode].filter(Boolean).join(', ');

    console.log('[Shipday] Requesting availability quote:', { pickupStr, dropoffStr });

    try {
      const deliveryTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      console.log(JSON.stringify({
        pickupAddress: pickupStr,
        deliveryAddress: dropoffStr,
        deliveryTime: deliveryTime
      }))
      const response = await fetch('https://api.shipday.com/on-demand/availability', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pickupAddress: pickupStr,
          deliveryAddress: dropoffStr,
          deliveryTime: deliveryTime
        })
      });

      if (!response.ok) {
        throw new Error(`Shipday API error ${response.status}: ${await response.text()}`);
      }

      const responseData = await response.json();
      console.log('[Shipday API] checkAvailability response:', JSON.stringify(responseData, null, 2));

      const options = Array.isArray(responseData) ? responseData : responseData.options;

      if (!Array.isArray(options) || options.length === 0) {
        throw new Error('No delivery quotes available for this address');
      }

      const validOptions = options.filter((option): option is Record<string, unknown> => {
        const fee = typeof option?.fee === 'number' ? option.fee : Number(option?.fee);
        return option?.error !== true && Number.isFinite(fee);
      });

      if (validOptions.length === 0) {
        const firstError = options.find((option: Record<string, unknown>) => option?.error === true);
        const errorMessage =
          typeof firstError?.errorMessage === 'string' && firstError.errorMessage.trim()
            ? firstError.errorMessage
            : 'No valid delivery quotes available for this address';
        throw new Error(errorMessage);
      }

      const bestOption = validOptions.reduce((best, current) => {
        const bestFee = typeof best.fee === 'number' ? best.fee : Number(best.fee);
        const currentFee = typeof current.fee === 'number' ? current.fee : Number(current.fee);
        return currentFee < bestFee ? current : best;
      });

      const fee = typeof bestOption.fee === 'number' ? bestOption.fee : Number(bestOption.fee);
      const currency =
        typeof bestOption.currency === 'string' && bestOption.currency.trim()
          ? bestOption.currency
          : 'AUD';
      const pickupTime = typeof bestOption.pickupTime === 'string' ? bestOption.pickupTime : null;
      const deliveryTimeStr = typeof bestOption.deliveryTime === 'string' ? bestOption.deliveryTime : null;

      let durationMinutes =
        typeof bestOption.deliveryDuration === 'number'
          ? bestOption.deliveryDuration
          : Number(bestOption.deliveryDuration);

      if (!Number.isFinite(durationMinutes) && pickupTime && deliveryTimeStr) {
        const start = new Date(pickupTime).getTime();
        const end = new Date(deliveryTimeStr).getTime();
        if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
          durationMinutes = Math.ceil((end - start) / 60000);
        }
      }

      const distanceKm =
        pickup.latitude != null &&
          pickup.longitude != null &&
          dropoff.latitude != null &&
          dropoff.longitude != null
          ? this.calculateDistance(pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude)
          : undefined;

      console.log(`[Shipday] Final Quote: Fee=${fee}, Currency=${currency}, Provider=${String(bestOption.name ?? 'unknown')}`);

      return {
        quote_id: typeof bestOption.id === 'string' && bestOption.id.trim()
          ? bestOption.id
          : `sd_quote_${Date.now()}`,
        fee: Math.round(fee * 100) / 100,
        currency,
        distance_km: typeof distanceKm === 'number' ? Math.round(distanceKm * 10) / 10 : undefined,
        estimated_duration_minutes: Number.isFinite(durationMinutes) ? durationMinutes : undefined,
        estimated_duration_seconds: Number.isFinite(durationMinutes) ? durationMinutes * 60 : undefined,
        expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      };
    } catch (error) {
      console.error('[Shipday SDK] Error getting availability:', error);
      throw error instanceof Error ? error : new Error('Failed to get delivery quote');
    }
  }


  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private toShipdayDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toShipdayTime(date: Date): string {
    return date.toISOString().slice(11, 19);
  }

  private parseIsoDate(value?: string | null): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private normalizePaymentMethod(method?: 'online' | 'store'): 'credit_card' | 'cash' | undefined {
    if (method === 'online') return 'credit_card';
    if (method === 'store') return 'cash';
    return undefined;
  }

  private getStorePhone(): string {
    return (
      process.env.STORE_PHONE ||
      process.env.NEXT_PUBLIC_STORE_PHONE ||
      '0397438150'
    );
  }

  private getStoreName(): string {
    return process.env.STORE_NAME || process.env.NEXT_PUBLIC_STORE_NAME || "Pappa's Ocean Catch";
  }

  private getStoreAddressFallback(): string {
    return (
      process.env.STORE_ADDRESS ||
      process.env.NEXT_PUBLIC_STORE_ADDRESS ||
      '2/87 Unitt Street, Melton VIC 3337'
    );
  }

  async createDelivery(req: CreateDeliveryRequest): Promise<CreateDeliveryResponse> {
    const placedAt = this.parseIsoDate(req.placed_at) ?? new Date();
    const expectedPickupAt =
      this.parseIsoDate(req.expected_pickup_at) ?? new Date(placedAt.getTime() + 10 * 60 * 1000);
    const paymentMethod = this.normalizePaymentMethod(req.payment_method);

    const payload = {
      orderNumber: req.external_order_id,
      customerName: req.customer_name,
      customerEmail: req.customer_email,
      customerAddress: req.delivery_address,
      customerPhoneNumber: req.customer_phone,
      restaurantName: this.getStoreName(),
      restaurantAddress: req.pickup_address || this.getStoreAddressFallback(),
      restaurantPhoneNumber: this.getStorePhone(),
      expectedPickupTime: this.toShipdayTime(expectedPickupAt),
      pickupLatitude: req.pickup_latitude ?? undefined,
      pickupLongitude: req.pickup_longitude ?? undefined,
      deliveryLatitude: req.delivery_latitude ?? undefined,
      deliveryLongitude: req.delivery_longitude ?? undefined,
      deliveryFee: req.delivery_fee || 0,
      tips: req.tips || 0,
      tax: req.tax || 0,
      discountAmount: req.discount_amount || 0,
      totalOrderCost: req.total_amount || 0,
      orderSource: 'online_ordering',
      additionalId: req.external_order_id,
      paymentMethod,
      deliveryInstruction: req.special_instructions || '',
      orderItem: req.items?.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unit_price || 0,
        addOns: i.add_ons && i.add_ons.length > 0 ? i.add_ons : undefined,
        detail: i.detail || undefined,
      })) || []
    };

    console.log('[Shipday SDK] Inserting order with payload:', JSON.stringify(payload, null, 2));

    try {
      // The shipday SDK expects an OrderInfoRequest object that has a getRequestBody() method
      const shipdayRequest = {
        getRequestBody: () => payload
      };

      const response = await this.sdk.orderService.insertOrder(shipdayRequest);
      console.log('[Shipday SDK] Response received:', JSON.stringify(response, null, 2));
      return {
        delivery_id: response.orderId || response.id || '',
        order_number: response.orderNumber || '',
        status: 'created',
        tracking_url: response.trackingUrl || response.tracking_url || '',
        raw: response
      };
    } catch (error) {
      console.error('[Shipday SDK] Error inserting order:', error);
      throw error;
    }

  }

  async markDeliveryReady(req: MarkDeliveryReadyRequest): Promise<CreateDeliveryResponse> {
    const shipdayOrderId = Number(req.delivery_id);
    if (!Number.isFinite(shipdayOrderId) || shipdayOrderId <= 0) {
      throw new Error('Invalid Shipday delivery id');
    }

    try {
      const endpoint = `https://api.shipday.com/orders/${shipdayOrderId}/meta`;
      console.log('[Shipday SDK] Marking delivery ready via Shipday API:', endpoint);

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          readyToPickup: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Shipday API error ${response.status}: ${await response.text()}`);
      }

      const responseData = await response.json().catch(() => ({}));
      const responseBody = responseData && typeof responseData === 'object' ? responseData : {};
      console.log('[Shipday SDK] Ready update response:', JSON.stringify(responseBody, null, 2));
      return {
        delivery_id: String((responseBody as any).orderId || (responseBody as any).id || shipdayOrderId),
        order_number: String((responseBody as any).orderNumber || ''),
        status: 'ready',
        tracking_url: (responseBody as any).trackingUrl || (responseBody as any).tracking_url || '',
        raw: responseBody
      };
    } catch (error) {
      console.error('[Shipday SDK] Error marking delivery ready:', error);
      throw error;
    }
  }
}

let client: ShipdayClient | null = null;

export function getShipdayClient() {
  if (!client) {
    const key = process.env.SHIPDAY_API_KEY || '';
    if (!key) {
      console.warn('SHIPDAY_API_KEY is not set');
    }
    client = new ShipdayClient(key);
  }
  return client;
}

export default getShipdayClient;
