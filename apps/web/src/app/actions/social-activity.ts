import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { v4 as uuidv4 } from 'uuid';

// Like or dislike a menu item
export async function likeItem({ userId, itemId, isLike }: { userId: string, itemId: string, isLike: boolean }) {
    const supabase = await createServiceRoleClient();
    const { error } = await supabase.from('item_likes').upsert({
        id: uuidv4(),
        user_id: userId,
        item_id: itemId,
        is_like: isLike,
        created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,item_id' } as any);
    return { error };
}

// Get like/dislike count for an item
export async function getItemLikes(itemId: string) {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase.from('item_likes')
        .select('is_like')
        .eq('item_id', itemId);
    if (error) return { likes: 0, dislikes: 0, error };
    const likes = data.filter((d: any) => d.is_like).length;
    const dislikes = data.filter((d: any) => !d.is_like).length;
    return { likes, dislikes, error: null };
}

// Add a review for an item
export async function addItemReview({ userId, itemId, rating, comment }: { userId: string, itemId: string, rating: number, comment: string }) {
    const supabase = await createServiceRoleClient();
    const { error } = await supabase.from('item_reviews').insert({
        id: uuidv4(),
        user_id: userId,
        item_id: itemId,
        rating,
        comment,
        created_at: new Date().toISOString(),
    });
    return { error };
}

// Get reviews for an item
export async function getItemReviews(itemId: string) {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase.from('item_reviews')
        .select('id, user_id, rating, comment, created_at')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });
    return { reviews: data, error };
}

// Add a review for an order
export async function addOrderReview({ userId, orderId, rating, comment }: { userId: string, orderId: string, rating: number, comment: string }) {
    const supabase = await createServiceRoleClient();
    const { error } = await supabase.from('order_reviews').upsert({
        id: uuidv4(),
        user_id: userId,
        order_id: orderId,
        rating,
        comment,
        created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,order_id' } as any);
    return { error };
}

// Get reviews for an order
export async function getOrderReviews(orderId: string) {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase.from('order_reviews')
        .select('id, user_id, rating, comment, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });
    console.debug('[getOrderReviews] Raw data:', data);
    console.debug('[getOrderReviews] Error:', error);
    // Ensure plain objects only
    const reviews = Array.isArray(data)
        ? data.map(r => ({
            id: r.id,
            user_id: r.user_id,
            rating: r.rating,
            comment: r.comment,
            created_at: typeof r.created_at === 'string' ? r.created_at : (r.created_at?.toISOString?.() ?? null)
        }))
        : [];
    console.debug('[getOrderReviews] Sanitized reviews:', reviews);
    return { reviews, error: error ? String(error.message || error) : null };
}
