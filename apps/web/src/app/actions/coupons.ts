'use server';

import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { 
    validateCoupon, 
    type Coupon, 
    type CouponValidationResult 
} from '@/lib/coupons';

function normalizeCoupon(row: any): Coupon {
    return {
        id: String(row.id),
        code: String(row.code),
        title: String(row.title),
        description: row.description ?? null,
        is_active: Boolean(row.is_active),
        discount_type: row.discount_type,
        discount_value: Number(row.discount_value ?? 0),
        starts_at: row.starts_at ?? null,
        ends_at: row.ends_at ?? null,
        max_uses: row.max_uses != null ? Number(row.max_uses) : null,
        usage_count: Number(row.usage_count ?? 0),
        max_uses_per_user: row.max_uses_per_user != null ? Number(row.max_uses_per_user) : null,
        user_id: row.user_id ?? null,
        target_email: row.target_email ?? null,
        min_cart_subtotal: Number(row.min_cart_subtotal ?? 0),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
    };
}

export async function validateCouponCode(params: {
    code: string;
    userId?: string | null;
    customerEmail?: string | null;
    cartSubtotal: number;
}): Promise<{ data: CouponValidationResult | null; error: string | null }> {
    try {
        const { code, userId, customerEmail, cartSubtotal } = params;
        const supabase = await createServiceRoleClient();

        // 1. Fetch coupon by code (case-insensitive)
        const { data: couponRow, error: fetchError } = await supabase
            .from('coupons')
            .select('*')
            .ilike('code', code.trim())
            .single();

        if (fetchError || !couponRow) {
            return { data: { isValid: false, coupon: null, error: 'not_found', discountAmount: 0 }, error: null };
        }

        const coupon = normalizeCoupon(couponRow);

        // 2. If user is logged in, check their redemption count for this coupon
        let userRedemptionCount = 0;
        if (userId) {
            const { count, error: countError } = await supabase
                .from('coupon_redemptions')
                .select('*', { count: 'exact', head: true })
                .eq('coupon_id', coupon.id)
                .eq('user_id', userId);
            
            if (!countError && count != null) {
                userRedemptionCount = count;
            }
        } else if (customerEmail) {
            // Optional: fallback to email-based redemption check if not logged in
            // This is more complex if orders are anonymous but we want to track by email
            // For now, only track by userId if provided.
        }

        // 3. Run validation logic
        const result = validateCoupon({
            coupon,
            userId,
            customerEmail,
            cartSubtotal,
            userRedemptionCount,
        });

        return { data: result, error: null };
    } catch (err) {
        console.error('Unexpected error validating coupon:', err);
        return { data: null, error: 'An unexpected error occurred' };
    }
}

export async function getCoupons(): Promise<{ data: Coupon[] | null; error: string | null }> {
    try {
        const supabase = await createServiceRoleClient();
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { data: (data || []).map(normalizeCoupon), error: null };
    } catch (err) {
        console.error('Error fetching coupons:', err);
        return { data: null, error: err instanceof Error ? err.message : 'Failed to fetch coupons' };
    }
}

export async function createCoupon(payload: any): Promise<{ data: Coupon | null; error: string | null }> {
    try {
        const supabase = await createServiceRoleClient();
        const { data, error } = await supabase
            .from('coupons')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return { data: normalizeCoupon(data), error: null };
    } catch (err) {
        console.error('Error creating coupon:', err);
        return { data: null, error: err instanceof Error ? err.message : 'Failed to create coupon' };
    }
}

export async function updateCoupon(id: string, payload: any): Promise<{ data: Coupon | null; error: string | null }> {
    try {
        const supabase = await createServiceRoleClient();
        const { data, error } = await supabase
            .from('coupons')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return { data: normalizeCoupon(data), error: null };
    } catch (err) {
        console.error('Error updating coupon:', err);
        return { data: null, error: err instanceof Error ? err.message : 'Failed to update coupon' };
    }
}

export async function deleteCoupon(id: string): Promise<{ success: boolean; error: string | null }> {
    try {
        const supabase = await createServiceRoleClient();
        const { error } = await supabase
            .from('coupons')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true, error: null };
    } catch (err) {
        console.error('Error deleting coupon:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Failed to delete coupon' };
    }
}
