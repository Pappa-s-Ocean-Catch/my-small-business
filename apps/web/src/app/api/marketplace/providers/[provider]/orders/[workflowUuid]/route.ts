import { NextResponse } from 'next/server';
import { createMarketplaceProviderClient } from '@my-small-business/marketplace';
import { authenticateMarketplaceRequest, getMarketplaceCredentialBundle, parseMarketplaceProvider } from '@/lib/marketplace-credentials';

type RouteContext = { params: Promise<{ provider: string; workflowUuid: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateMarketplaceRequest(request);
    if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const { provider: rawProvider, workflowUuid } = await context.params;
    const provider = parseMarketplaceProvider(rawProvider);
    if (!provider) return NextResponse.json({ success: false, error: 'Unsupported marketplace provider' }, { status: 400 });
    if (!workflowUuid?.trim()) return NextResponse.json({ success: false, error: 'workflowUuid is required' }, { status: 400 });
    const client = createMarketplaceProviderClient({
      getSession: async (requestedProvider) => {
        const { cookies, providerConfig, updatedAt } = await getMarketplaceCredentialBundle(requestedProvider);
        return { provider: requestedProvider, cookies, providerConfig, updatedAt };
      },
    });
    const result = await client.getOrderDetail(provider, workflowUuid.trim(), {
      mode: new URL(request.url).searchParams.get('mode') === 'live' ? 'live' : 'history',
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 });
  }
}
