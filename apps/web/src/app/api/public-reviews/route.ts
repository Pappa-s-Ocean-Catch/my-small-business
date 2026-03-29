import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    try {
        const supabase = await createServiceRoleClient();
        // Fetch order_reviews (internal) and external_reviews (external)
        const { data: orderReviews, error: orderError } = await supabase.from('order_reviews')
            .select('id, rating, comment, created_at, user_id')
            .order('created_at', { ascending: false });
        if (orderError) {
            return NextResponse.json({ error: orderError }, { status: 500 });
        }
        // Get unique user_ids for order_reviews
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
        // Fetch external reviews
        const { data: externalReviews, error: externalError } = await supabase.from('external_reviews')
            .select('id, rating, message, response, name, date, created_at, source')
            .order('created_at', { ascending: false });
        if (externalError) {
            console.error('[public-reviews] external_reviews error:', externalError);
        }

        // Debug logs
        console.log(`[API] orderReviews: ${orderReviews?.length || 0}, externalReviews: ${externalReviews?.length || 0}`);

        // Normalize order_reviews
        interface OrderReviewRow {
            id: string;
            rating: number;
            comment: string;
            created_at: string;
            user_id: string;
        }
        const normOrder = (r: OrderReviewRow) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            user_name: userMap[r.user_id] || 'Anonymous',
            source: 'internal',
        });

        // Normalize external_reviews (use only rating column)
        const normExternal = (r: any) => ({
            id: String(r.id),
            rating: typeof r.rating === 'number' ? r.rating : 0,
            comment: r.message || r.response || '',
            created_at: r.date || r.created_at || null,
            user_name: r.name || 'External',
            source: r.source || 'external',
        });

        const allReviews = [
            ...(orderReviews || []).map(normOrder),
            ...(externalReviews || []).map(normExternal)
        ].filter(r => r.rating > 0).sort((a, b) => {
            // Sort: reviews with date/created_at first, then by id descending as fallback
            const aTime = rTime(a);
            const bTime = rTime(b);
            if (aTime && bTime) return bTime - aTime;
            if (aTime) return -1;
            if (bTime) return 1;
            return (b.id || 0) - (a.id || 0);
        });

        function rTime(r) {
            if (r.created_at) return new Date(r.created_at).getTime();
            if (r.date) return new Date(r.date).getTime();
            return null;
        }

        console.log(`[API] merged reviews: ${allReviews.length}, page: ${page}, limit: ${limit}`);

        const pagedReviews = allReviews.slice((page - 1) * limit, page * limit);
        const avg = allReviews.length > 0 ? allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / allReviews.length : 0;
        // For reviews with no date, set created_at to undefined so frontend can hide date
        const pagedReviewsNoDate = pagedReviews.map(r => ({ ...r, created_at: r.created_at || r.date || undefined }));
        return NextResponse.json({ reviews: pagedReviewsNoDate, avg, count: allReviews.length });
    } catch (err) {
        console.error('[public-reviews] Caught error:', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
