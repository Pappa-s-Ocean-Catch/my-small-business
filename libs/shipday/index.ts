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
  items?: Array<{ name: string; quantity: number; unit_price?: number }>;
  total_amount?: number;
  tax?: number;
  delivery_fee?: number;
  tips?: number;
  special_instructions?: string;
  assign_driver?: boolean;
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
   * We calculate it based on actual driving distance using Google Maps if available.
   */
  async requestQuote(pickup: DeliveryAddress, dropoff: DeliveryAddress): Promise<DeliveryQuote> {
    let distanceKm = 5; // Default fallback
    let durationMinutes = 25; // Default fallback

    const pickupStr = [pickup.address_line1, pickup.city, pickup.state, pickup.postcode].filter(Boolean).join(', ');
    const dropoffStr = [dropoff.address_line1, dropoff.city, dropoff.state, dropoff.postcode].filter(Boolean).join(', ');

    console.log('[Shipday] Requesting availability quote:', { pickupStr, dropoffStr });

    let fee = 7.50; // default fee
    let currency = 'AUD';

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

      if (Array.isArray(options) && options.length > 0) {
        // Find the best price among Uber, DoorDash, etc.
        let bestOption = options[0];
        for (const option of options) {
          if (option.deliveryFee < bestOption.deliveryFee) {
            bestOption = option;
          }
        }
        fee = bestOption.deliveryFee;
        if (bestOption.currency) currency = bestOption.currency;
        if (bestOption.estimatedDistance) distanceKm = bestOption.estimatedDistance;

        if (bestOption.estimatedDeliveryTime && bestOption.estimatedPickupTime) {
          const start = new Date(bestOption.estimatedPickupTime).getTime();
          const end = new Date(bestOption.estimatedDeliveryTime).getTime();
          if (!isNaN(start) && !isNaN(end)) {
            durationMinutes = Math.ceil((end - start) / 60000);
          }
        }
      } else {
        console.warn('[Shipday SDK] No availability options returned, falling back to calculation');
        if (pickup.latitude && pickup.longitude && dropoff.latitude && dropoff.longitude) {
          distanceKm = this.calculateDistance(pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude);
        }
        durationMinutes = 10 + Math.ceil(distanceKm * 3);
        const baseFee = 7.50;
        const freeDistance = 2.0;
        const ratePerKm = 2.0;
        fee = distanceKm <= freeDistance ? baseFee : baseFee + (distanceKm - freeDistance) * ratePerKm;
      }
    } catch (error) {
      console.error('[Shipday SDK] Error getting availability:', error);
      if (pickup.latitude && pickup.longitude && dropoff.latitude && dropoff.longitude) {
        distanceKm = this.calculateDistance(pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude);
      }
      durationMinutes = 10 + Math.ceil(distanceKm * 3);
      const baseFee = 7.50;
      const freeDistance = 2.0;
      const ratePerKm = 2.0;
      fee = distanceKm <= freeDistance ? baseFee : baseFee + (distanceKm - freeDistance) * ratePerKm;
    }

    console.log(`[Shipday] Final Quote: Fee=${fee}, Currency=${currency}`);

    return {
      quote_id: `sd_quote_${Date.now()}`,
      fee: Math.round(fee * 100) / 100,
      currency: currency,
      distance_km: Math.round(distanceKm * 10) / 10,
      estimated_duration_minutes: durationMinutes,
      estimated_duration_seconds: durationMinutes * 60,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
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

  async createDelivery(req: CreateDeliveryRequest): Promise<CreateDeliveryResponse> {
    const payload = {
      orderNumber: req.external_order_id,
      customerName: req.customer_name,
      customerEmail: req.customer_email,
      customerAddress: req.delivery_address,
      customerPhoneNumber: req.customer_phone,
      restaurantName: process.env.NEXT_PUBLIC_STORE_NAME || "Pappa's Ocean Catch",
      restaurantAddress: req.pickup_address || process.env.NEXT_PUBLIC_STORE_ADDRESS || "123 Main St, Melton VIC 3337",
      restaurantPhoneNumber: process.env.NEXT_PUBLIC_STORE_PHONE || "0397431234",
      expectedDeliveryDate: new Date().toISOString().split('T')[0],
      expectedDeliveryTime: new Date(Date.now() + 45 * 60 * 1000).toLocaleTimeString('en-AU', { hour12: false }),
      deliveryFee: req.delivery_fee || 0,
      tips: req.tips || 0,
      totalOrderCost: req.total_amount || 0,
      tax: req.tax || 0,
      deliveryInstruction: req.special_instructions || '',
      orderItem: req.items?.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unit_price || 0
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

