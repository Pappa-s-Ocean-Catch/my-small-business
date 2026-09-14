import { NextResponse } from 'next/server';
import {
  authenticateMarketplaceRequest,
  getMarketplaceSessionBundle,
  parseMarketplaceProvider,
} from '@/lib/marketplace-credentials';

type RouteContext = { params: Promise<{ provider: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateMarketplaceRequest(request);
    if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const { provider: rawProvider } = await context.params;
    const provider = parseMarketplaceProvider(rawProvider);
    if (!provider) return NextResponse.json({ success: false, error: 'Unsupported marketplace provider' }, { status: 400 });
    const data = await getMarketplaceSessionBundle(provider);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 });
  }
}
