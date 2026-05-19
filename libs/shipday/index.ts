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
    const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    console.log('[Shipday] Requesting quote:', { 
      pickup: { lat: pickup.latitude, lng: pickup.longitude }, 
      dropoff: { lat: dropoff.latitude, lng: dropoff.longitude } 
    });

    if (pickup.latitude && pickup.longitude && dropoff.latitude && dropoff.longitude) {
      if (googleApiKey) {
        try {
          const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${pickup.latitude},${pickup.longitude}&destinations=${dropoff.latitude},${dropoff.longitude}&key=${googleApiKey}`;
          const res = await fetch(url);
          const data = await res.json();

          if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
            const element = data.rows[0].elements[0];
            distanceKm = element.distance.value / 1000;
            durationMinutes = Math.ceil(element.duration.value / 60) + 10; // +10 mins for prep
            console.log(`[Shipday] Google Distance: ${distanceKm}km, Duration: ${durationMinutes}min`);
          } else {
            // Fallback to straight line if Google fails
            console.warn('[Shipday] Google Matrix API returned non-OK status:', data.status);
            distanceKm = this.calculateDistance(pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude);
            durationMinutes = 10 + Math.ceil(distanceKm * 3);
            console.log(`[Shipday] Fallback Haversine Distance: ${distanceKm}km`);
          }
        } catch (err) {
          console.error('[Shipday] Google Distance Matrix error:', err);
          distanceKm = this.calculateDistance(pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude);
          durationMinutes = 10 + Math.ceil(distanceKm * 3);
        }
      } else {
        console.warn('[Shipday] Google API Key missing, using Haversine fallback');
        distanceKm = this.calculateDistance(pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude);
        durationMinutes = 10 + Math.ceil(distanceKm * 3);
      }
    } else {
      console.warn('[Shipday] Missing coordinates for quote, using default distance');
    }

    // Custom fee logic (Updated to be more realistic for Shipday Drive)
    // $7.50 base + $2.0 per km after 2km
    const baseFee = 7.50;
    const freeDistance = 2.0;
    const ratePerKm = 2.0;
    
    const fee = distanceKm <= freeDistance 
      ? baseFee 
      : baseFee + (distanceKm - freeDistance) * ratePerKm;

    console.log(`[Shipday] Final Quote: Distance=${distanceKm}km, Fee=$${fee}, Currency=AUD`);

    return {
      quote_id: `sd_quote_${Date.now()}`,
      fee: Math.round(fee * 100) / 100,
      currency: 'AUD',
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

