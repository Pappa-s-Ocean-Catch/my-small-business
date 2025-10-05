import { NextRequest, NextResponse } from 'next/server';

interface TryPosHubConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  customer?: {
    name: string;
    email?: string;
    phone?: string;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}

class TryPosHubAPI {
  private config: TryPosHubConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.config = {
      clientId: process.env.TRYPOSHUB_CLIENT_ID || '',
      clientSecret: process.env.TRYPOSHUB_CLIENT_SECRET || '',
      baseUrl: 'https://api.tryposhub.com'
    };
    
    console.log('🔧 TryPosHub API Configuration:', {
      baseUrl: this.config.baseUrl,
      clientId: this.config.clientId ? `${this.config.clientId.substring(0, 8)}...` : 'MISSING',
      clientSecret: this.config.clientSecret ? `${this.config.clientSecret.substring(0, 8)}...` : 'MISSING',
      envCheck: {
        TRYPOSHUB_CLIENT_ID: process.env.TRYPOSHUB_CLIENT_ID ? 'SET' : 'NOT_SET',
        TRYPOSHUB_CLIENT_SECRET: process.env.TRYPOSHUB_CLIENT_SECRET ? 'SET' : 'NOT_SET'
      }
    });
  }


  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      console.log('✅ Using cached access token');
      return this.accessToken;
    }

    console.log('🔐 Attempting to get new access token...');
    console.log('📋 Config check:', {
      baseUrl: this.config.baseUrl,
      clientId: this.config.clientId ? `${this.config.clientId.substring(0, 8)}...` : 'MISSING',
      clientSecret: this.config.clientSecret ? `${this.config.clientSecret.substring(0, 8)}...` : 'MISSING'
    });

    try {
      console.log('📤 Making request to:', `${this.config.baseUrl}/oauth2/token`);
      console.log('📤 Using standard OAuth2 client credentials flow');

      // Create form-encoded body with client credentials
      const formData = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      });

      console.log('📋 Form data being sent:', {
        grant_type: 'client_credentials',
        client_id: this.config.clientId ? `${this.config.clientId.substring(0, 8)}...` : 'MISSING',
        client_secret: this.config.clientSecret ? `${this.config.clientSecret.substring(0, 8)}...` : 'MISSING'
      });

      const response = await fetch(`${this.config.baseUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Authentication failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to get access token: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Authentication successful:', {
        tokenType: data.token_type,
        expiresIn: data.expires_in,
        scope: data.scope,
        hasAccessToken: !!data.access_token
      });

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer
      
      console.log('💾 Token cached, expires at:', new Date(this.tokenExpiry).toISOString());
      return this.accessToken!;
    } catch (error) {
      console.error('❌ Error getting access token:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to authenticate with TryPosHub API: ${error.message}`);
      }
      throw new Error('Failed to authenticate with TryPosHub API');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<unknown> {
    console.log('🌐 Making API request to:', `${this.config.baseUrl}${endpoint}`);
    
    const token = await this.getAccessToken();
    console.log('🔑 Using token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    console.log('📥 API Response status:', response.status);
    console.log('📥 API Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ API request successful, data keys:', Object.keys(data));
    return data;
  }

  async getOrders(params: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<OrdersResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.status) queryParams.append('status', params.status);
    if (params.startDate) queryParams.append('start_date', params.startDate);
    if (params.endDate) queryParams.append('end_date', params.endDate);

    const endpoint = `/orders${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    return this.makeRequest(endpoint) as Promise<OrdersResponse>;
  }
}

// Create a singleton instance
const tryposhubAPI = new TryPosHubAPI();

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Server-side: Starting to fetch orders...');
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || undefined;

    const params = {
      page,
      limit,
      ...(status && status !== 'all' && { status })
    };

    console.log('📋 Server-side: Fetching orders with params:', params);
    const response = await tryposhubAPI.getOrders(params);
    console.log('📦 Server-side: Orders response:', {
      hasOrders: !!response.orders,
      ordersCount: response.orders?.length || 0,
      total: response.total,
      page: response.page,
      limit: response.limit
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Server-side: Error fetching orders:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch orders',
        orders: [],
        total: 0,
        page: 1,
        limit: 20
      },
      { status: 500 }
    );
  }
}
