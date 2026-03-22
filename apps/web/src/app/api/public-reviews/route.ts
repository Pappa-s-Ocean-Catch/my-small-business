import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    try {
        console.log('[public-reviews] SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'NOT SET');
        const supabase = await createServiceRoleClient();
        // Fetch all item_reviews and order_reviews (public, for all products)
        // Only use order_reviews with user name from profiles
        const { data: orderReviews, error: orderError } = await supabase.from('order_reviews')
            .select('id, rating, comment, created_at, user_id')
            .order('created_at', { ascending: false });
        if (orderError) {
            console.error('[public-reviews] orderReviews error:', orderError);
            return NextResponse.json({ error: orderError }, { status: 500 });
        }
        // Get unique user_ids
        const userIds = Array.from(new Set((orderReviews || []).map(r => r.user_id).filter(Boolean)));
        let userMap: { [key: string]: string | undefined } = {};
        if (userIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabase.from('profiles')
                .select('id, full_name')
                .in('id', userIds);
            if (profilesError) {
                console.error('[public-reviews] profiles error:', profilesError);
            } else {
                userMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
            }
        }
        interface OrderReviewRow {
            id: string;
            rating: number;
            comment: string;
            created_at: string;
            user_id: string;
        }
        const norm = (r: OrderReviewRow) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            user_name: userMap[r.user_id] || 'Anonymous',
        });
        const allReviews = (orderReviews || []).map(norm).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const pagedReviews = allReviews.slice((page - 1) * limit, page * limit);
        const avg = allReviews.length > 0 ? allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / allReviews.length : 0;
        return NextResponse.json({ reviews: pagedReviews, avg, count: allReviews.length });
    } catch (err) {
        console.error('[public-reviews] Caught error:', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
