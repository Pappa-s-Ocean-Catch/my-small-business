import { NextResponse } from 'next/server';
import { createMarketplaceProviderClient } from '@my-small-business/marketplace';
import { authenticateMarketplaceRequest, getMarketplaceCredentialBundle, parseMarketplaceProvider } from '@/lib/marketplace-credentials';

type RouteContext = { params: Promise<{ provider: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateMarketplaceRequest(request);
    if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const provider = parseMarketplaceProvider((await context.params).provider);
    if (!provider) return NextResponse.json({ success: false, error: 'Unsupported marketplace provider' }, { status: 400 });
    const client = createMarketplaceProviderClient({
      getSession: async (requestedProvider) => {
        const { cookies, providerConfig, updatedAt } = await getMarketplaceCredentialBundle(requestedProvider);
        return { provider: requestedProvider, cookies, providerConfig, updatedAt };
      },
    });
    const cursor = new URL(request.url).searchParams.get('cursor')?.trim() || undefined;
    return NextResponse.json({ success: true, data: await client.getActiveOrders(provider, cursor) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 });
  }
}
