import { NextResponse } from 'next/server';
import { createMarketplaceProviderClient, type MarketplaceHistoryDateRange } from '@my-small-business/marketplace';
import { authenticateMarketplaceRequest, getMarketplaceCredentialBundle, parseMarketplaceProvider } from '@/lib/marketplace-credentials';

type RouteContext = { params: Promise<{ provider: string }> };

function parseHistoryDateRange(value: string | null): MarketplaceHistoryDateRange {
  return ['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_7_DAYS', 'LAST_30_DAYS', 'LAST_12_WEEKS', 'CUSTOM'].includes(value || '')
    ? value as MarketplaceHistoryDateRange : 'TODAY';
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateMarketplaceRequest(request);
    if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const provider = parseMarketplaceProvider((await context.params).provider);
    if (!provider) return NextResponse.json({ success: false, error: 'Unsupported marketplace provider' }, { status: 400 });
    const url = new URL(request.url);
    const client = createMarketplaceProviderClient({
      getSession: async (requestedProvider) => {
        const { cookies, providerConfig, updatedAt } = await getMarketplaceCredentialBundle(requestedProvider);
        return { provider: requestedProvider, cookies, providerConfig, updatedAt };
      },
    });
    const result = await client.getHistory(provider, {
      cursor: url.searchParams.get('cursor')?.trim() || undefined,
      dateRange: parseHistoryDateRange(url.searchParams.get('dateRange')),
      mode: url.searchParams.get('mode') === 'scheduled' ? 'scheduled' : 'history',
      statuses: (url.searchParams.get('statuses') || '').split(',').map((value) => value.trim()).filter(Boolean),
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 });
  }
}
