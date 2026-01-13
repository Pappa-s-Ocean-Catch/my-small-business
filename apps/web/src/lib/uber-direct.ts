/**
 * Uber Direct API Integration
 * Documentation: https://developer.uber.com/docs/deliveries/guides/getting-started
 */

export interface UberDirectConfig {
  clientId: string;
  clientSecret: string;
  serverToken: string;
  sandbox: boolean; // Use sandbox environment
}

export interface DeliveryAddress {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postcode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface DeliveryQuote {
  quote_id: string;
  fee: number;
  currency: string;
  expires_at: string;
  estimated_pickup_time: string;
  estimated_delivery_time: string;
  estimated_duration_seconds: number;
}

export interface CreateDeliveryRequest {
  pickup_address: DeliveryAddress;
  dropoff_address: DeliveryAddress;
  pickup_phone_number: string;
  dropoff_phone_number: string;
  dropoff_contact_name: string;
  dropoff_contact_email?: string;
  dropoff_contact_phone: string;
  external_store_id?: string;
  external_order_id?: string;
  items?: Array<{
    name: string;
    quantity: number;
  }>;
  special_instructions?: string;
}

export interface DeliveryResponse {
  delivery_id: string;
  status: string;
  tracking_url?: string;
  driver?: {
    name: string;
    phone: string;
    vehicle?: {
      make?: string;
      model?: string;
      license_plate?: string;
    };
  };
  estimated_pickup_time?: string;
  estimated_delivery_time?: string;
}

export interface DeliveryStatus {
  delivery_id: string;
  status: 'pending' | 'quote_requested' | 'quote_received' | 'delivery_created' | 'driver_assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled' | 'failed';
  tracking_url?: string;
  driver?: {
    name: string;
    phone: string;
    vehicle?: {
      make?: string;
      model?: string;
      license_plate?: string;
    };
  };
  estimated_pickup_time?: string;
  estimated_delivery_time?: string;
  current_location?: {
    latitude: number;
    longitude: number;
  };
}

class UberDirectClient {
  private config: UberDirectConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: UberDirectConfig) {
    this.config = config;
  }

  private getBaseUrl(): string {
    return this.config.sandbox
      ? 'https://sandbox-api.uber.com/v1'
      : 'https://api.uber.com/v1';
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await fetch('https://login.uber.com/oauth/v2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'client_credentials',
          scope: 'eats.deliveries',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get access token: ${response.status} ${error}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Set expiration to 5 minutes before actual expiration for safety
      this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

      if (!this.accessToken) {
        throw new Error('Failed to get access token: token is null');
      }

      return this.accessToken;
    } catch (error) {
      console.error('[Uber Direct] Error getting access token:', error);
      throw error;
    }
  }

  /**
   * Request a delivery quote
   */
  async requestQuote(
    pickupAddress: DeliveryAddress,
    dropoffAddress: DeliveryAddress
  ): Promise<DeliveryQuote> {
    try {
      const token = await this.getAccessToken();
      const baseUrl = this.getBaseUrl();

      const response = await fetch(`${baseUrl}/deliveries/quote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickup: {
            address: pickupAddress.address_line1,
            address_line2: pickupAddress.address_line2,
            city: pickupAddress.city,
            state: pickupAddress.state,
            postal_code: pickupAddress.postcode,
            country: pickupAddress.country || 'AU',
            ...(pickupAddress.latitude && pickupAddress.longitude && {
              coordinates: {
                latitude: pickupAddress.latitude,
                longitude: pickupAddress.longitude,
              },
            }),
          },
          dropoff: {
            address: dropoffAddress.address_line1,
            address_line2: dropoffAddress.address_line2,
            city: dropoffAddress.city,
            state: dropoffAddress.state,
            postal_code: dropoffAddress.postcode,
            country: dropoffAddress.country || 'AU',
            ...(dropoffAddress.latitude && dropoffAddress.longitude && {
              coordinates: {
                latitude: dropoffAddress.latitude,
                longitude: dropoffAddress.longitude,
              },
            }),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to request quote: ${response.status} ${error}`);
      }

      const data = await response.json();
      
      return {
        quote_id: data.quote_id,
        fee: parseFloat(data.fee),
        currency: data.currency || 'AUD',
        expires_at: data.expires_at,
        estimated_pickup_time: data.estimated_pickup_time,
        estimated_delivery_time: data.estimated_delivery_time,
        estimated_duration_seconds: data.estimated_duration_seconds || 0,
      };
    } catch (error) {
      console.error('[Uber Direct] Error requesting quote:', error);
      throw error;
    }
  }

  /**
   * Create a delivery request
   */
  async createDelivery(request: CreateDeliveryRequest): Promise<DeliveryResponse> {
    try {
      const token = await this.getAccessToken();
      const baseUrl = this.getBaseUrl();

      const response = await fetch(`${baseUrl}/deliveries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickup: {
            address: request.pickup_address.address_line1,
            address_line2: request.pickup_address.address_line2,
            city: request.pickup_address.city,
            state: request.pickup_address.state,
            postal_code: request.pickup_address.postcode,
            country: request.pickup_address.country || 'AU',
            ...(request.pickup_address.latitude && request.pickup_address.longitude && {
              coordinates: {
                latitude: request.pickup_address.latitude,
                longitude: request.pickup_address.longitude,
              },
            }),
            contact: {
              phone: request.pickup_phone_number,
            },
          },
          dropoff: {
            address: request.dropoff_address.address_line1,
            address_line2: request.dropoff_address.address_line2,
            city: request.dropoff_address.city,
            state: request.dropoff_address.state,
            postal_code: request.dropoff_address.postcode,
            country: request.dropoff_address.country || 'AU',
            ...(request.dropoff_address.latitude && request.dropoff_address.longitude && {
              coordinates: {
                latitude: request.dropoff_address.latitude,
                longitude: request.dropoff_address.longitude,
              },
            }),
            contact: {
              name: request.dropoff_contact_name,
              email: request.dropoff_contact_email,
              phone: request.dropoff_contact_phone,
            },
          },
          ...(request.external_store_id && { external_store_id: request.external_store_id }),
          ...(request.external_order_id && { external_order_id: request.external_order_id }),
          ...(request.items && { items: request.items }),
          ...(request.special_instructions && { special_instructions: request.special_instructions }),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create delivery: ${response.status} ${error}`);
      }

      const data = await response.json();
      
      return {
        delivery_id: data.delivery_id,
        status: data.status,
        tracking_url: data.tracking_url,
        driver: data.driver ? {
          name: data.driver.name,
          phone: data.driver.phone,
          vehicle: data.driver.vehicle,
        } : undefined,
        estimated_pickup_time: data.estimated_pickup_time,
        estimated_delivery_time: data.estimated_delivery_time,
      };
    } catch (error) {
      console.error('[Uber Direct] Error creating delivery:', error);
      throw error;
    }
  }

  /**
   * Get delivery status
   */
  async getDeliveryStatus(deliveryId: string): Promise<DeliveryStatus> {
    try {
      const token = await this.getAccessToken();
      const baseUrl = this.getBaseUrl();

      const response = await fetch(`${baseUrl}/deliveries/${deliveryId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get delivery status: ${response.status} ${error}`);
      }

      const data = await response.json();
      
      return {
        delivery_id: data.delivery_id,
        status: this.mapUberStatusToInternal(data.status),
        tracking_url: data.tracking_url,
        driver: data.driver ? {
          name: data.driver.name,
          phone: data.driver.phone,
          vehicle: data.driver.vehicle,
        } : undefined,
        estimated_pickup_time: data.estimated_pickup_time,
        estimated_delivery_time: data.estimated_delivery_time,
        current_location: data.current_location ? {
          latitude: data.current_location.latitude,
          longitude: data.current_location.longitude,
        } : undefined,
      };
    } catch (error) {
      console.error('[Uber Direct] Error getting delivery status:', error);
      throw error;
    }
  }

  /**
   * Map Uber Direct status to internal status
   */
  private mapUberStatusToInternal(uberStatus: string): DeliveryStatus['status'] {
    const statusMap: Record<string, DeliveryStatus['status']> = {
      'pending': 'pending',
      'quote_requested': 'quote_requested',
      'quote_received': 'quote_received',
      'delivery_created': 'delivery_created',
      'driver_assigned': 'driver_assigned',
      'picked_up': 'picked_up',
      'in_transit': 'in_transit',
      'delivered': 'delivered',
      'cancelled': 'cancelled',
      'failed': 'failed',
    };

    return statusMap[uberStatus] || 'pending';
  }
}

// Create singleton instance
let uberDirectClient: UberDirectClient | null = null;

export function getUberDirectClient(): UberDirectClient {
  if (!uberDirectClient) {
    const config: UberDirectConfig = {
      clientId: process.env.UBER_DIRECT_CLIENT_ID || '',
      clientSecret: process.env.UBER_DIRECT_CLIENT_SECRET || '',
      serverToken: process.env.UBER_DIRECT_SERVER_TOKEN || '',
      sandbox: process.env.UBER_DIRECT_SANDBOX === 'true' || process.env.NODE_ENV !== 'production',
    };

    if (!config.clientId || !config.clientSecret) {
      throw new Error('Uber Direct credentials are not configured. Please set UBER_DIRECT_CLIENT_ID and UBER_DIRECT_CLIENT_SECRET environment variables.');
    }

    uberDirectClient = new UberDirectClient(config);
  }

  return uberDirectClient;
}
