import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    if (!itemId) {
        return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
    }
    try {
        const supabase = await createServiceRoleClient();
        // Fetch item_reviews
        const { data: itemReviews, error: itemError } = await supabase.from('item_reviews')
            .select('id, rating, comment, created_at')
            .eq('item_id', itemId)
            .order('created_at', { ascending: false });
        if (itemError) {
            return NextResponse.json({ error: itemError }, { status: 500 });
        }

        // Fetch order_reviews for orders that include this product
        const { data: orderItems, error: orderItemsError } = await supabase.from('order_items')
            .select('order_id')
            .eq('product_id', itemId);
        if (orderItemsError) {
            return NextResponse.json({ error: orderItemsError }, { status: 500 });
        }
        const orderIds = (orderItems || []).map((oi: any) => oi.order_id);
        let orderReviews: any[] = [];
        if (orderIds.length > 0) {
            const { data: oReviews, error: oReviewsError } = await supabase.from('order_reviews')
                .select('id, rating, comment, created_at')
                .in('order_id', orderIds)
                .order('created_at', { ascending: false });
            if (oReviewsError) {
                return NextResponse.json({ error: oReviewsError }, { status: 500 });
            }
            orderReviews = oReviews || [];
        }

        // Merge and sort reviews by created_at desc
        const allReviews = [...(itemReviews || []), ...orderReviews].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const pagedReviews = allReviews.slice((page - 1) * limit, page * limit);
        const avg = allReviews.length > 0 ? allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / allReviews.length : 0;
        return NextResponse.json({ reviews: pagedReviews, avg, count: allReviews.length });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
