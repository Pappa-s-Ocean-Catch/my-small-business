import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    if (!itemId) {
        return new NextResponse(JSON.stringify({ error: 'Missing itemId' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=0, must-revalidate',
            },
        });
    }
    try {
        const supabase = await createServiceRoleClient();
        const { data, error } = await supabase.from('item_likes')
            .select('is_like')
            .eq('item_id', itemId);
        if (error) {
            return new NextResponse(JSON.stringify({ error }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=0, must-revalidate',
                },
            });
        }
        const likes = (data || []).filter((d: any) => d.is_like).length;
        const dislikes = (data || []).filter((d: any) => d.is_like === false).length;
        return new NextResponse(JSON.stringify({ likes, dislikes }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                // Vercel uses s-maxage for CDN caching; max-age caches repeat browser requests.
                'Cache-Control': 'public, max-age=86400, s-maxage=86400',
            },
        });
    } catch (err) {
        return new NextResponse(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=0, must-revalidate',
            },
        });
    }
}
