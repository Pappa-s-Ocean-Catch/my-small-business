import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
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
        // Fetch item_reviews
        const { data: itemReviews, error: itemError } = await supabase.from('item_reviews')
            .select('id, rating, comment, created_at')
            .eq('item_id', itemId)
            .order('created_at', { ascending: false });
        if (itemError) {
            return new NextResponse(JSON.stringify({ error: itemError }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=0, must-revalidate',
                },
            });
        }

        // Fetch order_reviews for orders that include this product
        const { data: orderItems, error: orderItemsError } = await supabase.from('order_items')
            .select('order_id')
            .eq('product_id', itemId);
        if (orderItemsError) {
            return new NextResponse(JSON.stringify({ error: orderItemsError }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=0, must-revalidate',
                },
            });
        }
        const orderIds = (orderItems || []).map((oi: any) => oi.order_id);
        let orderReviews: any[] = [];
        if (orderIds.length > 0) {
            const { data: oReviews, error: oReviewsError } = await supabase.from('order_reviews')
                .select('id, rating, comment, created_at')
                .in('order_id', orderIds)
                .order('created_at', { ascending: false });
            if (oReviewsError) {
                return new NextResponse(JSON.stringify({ error: oReviewsError }), {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'public, max-age=0, must-revalidate',
                    },
                });
            }
            orderReviews = oReviews || [];
        }

        // Merge and sort reviews by created_at desc
        const allReviews = [...(itemReviews || []), ...orderReviews].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const pagedReviews = allReviews.slice((page - 1) * limit, page * limit);
        const avg = allReviews.length > 0 ? allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / allReviews.length : 0;
        return new NextResponse(JSON.stringify({ reviews: pagedReviews, avg, count: allReviews.length }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                // Cache for 15 minutes (900 seconds)
                'Cache-Control': 'public, max-age=900, stale-while-revalidate=60',
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
