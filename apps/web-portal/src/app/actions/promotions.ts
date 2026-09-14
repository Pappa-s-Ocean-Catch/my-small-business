'use server';

import { createServiceRoleClient } from '@my-small-business/supabase/server';
import {
    type Promotion,
    type PromotionWithProducts,
    DEFAULT_STORE_TIMEZONE,
    isPromotionActiveNow,
} from '@/lib/promotions';

type PromotionRow = Promotion;

function normalizePromotion(row: any): Promotion {
    return {
        id: String(row.id),
        title: String(row.title),
        description: row.description ?? null,
        is_active: Boolean(row.is_active),
        applies_to: row.applies_to,
        discount_type: row.discount_type,
        discount_value: Number(row.discount_value ?? 0),
        starts_at: row.starts_at ?? null,
        ends_at: row.ends_at ?? null,
        days_of_week: (row.days_of_week as number[] | null) ?? null,
        daily_start_minute: row.daily_start_minute != null ? Number(row.daily_start_minute) : null,
        daily_end_minute: row.daily_end_minute != null ? Number(row.daily_end_minute) : null,
        product_scope: row.product_scope,
        min_product_price: row.min_product_price != null ? Number(row.min_product_price) : null,
        cart_scope: row.cart_scope,
        min_cart_subtotal: row.min_cart_subtotal != null ? Number(row.min_cart_subtotal) : null,
        show_on_home: Boolean(row.show_on_home),
        home_title: row.home_title ?? null,
        priority: Number(row.priority ?? 0),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
    };
}

export async function getPromotions(): Promise<{ data: PromotionWithProducts[] | null; error: string | null }> {
    try {
        const supabase = await createServiceRoleClient();
        const { data, error } = await supabase
            .from('promotions')
            .select('*, promotion_products(sale_product_id)')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching promotions:', error);
            return { data: null, error: error.message };
        }

        const normalized = (data || []).map((row: any) => {
            const promo = normalizePromotion(row);
            const productIds = (row.promotion_products || []).map((pp: any) => String(pp.sale_product_id));
            return {
                ...promo,
                product_ids: productIds,
            } satisfies PromotionWithProducts;
        });

        return { data: normalized, error: null };
    } catch (err) {
        console.error('Unexpected error fetching promotions:', err);
        return { data: null, error: 'An unexpected error occurred' };
    }
}

export async function getActivePromotions(timeZone: string = DEFAULT_STORE_TIMEZONE): Promise<{ data: PromotionWithProducts[] | null; error: string | null }> {
    const result = await getPromotions();
    if (result.error || !result.data) return result;

    const now = new Date();
    const active = result.data
        .filter((p) => isPromotionActiveNow(p, now, timeZone))
        .filter((p) => p.is_active);

    return { data: active, error: null };
}

export async function getHomePromotions(timeZone: string = DEFAULT_STORE_TIMEZONE): Promise<{ data: Promotion[] | null; error: string | null }> {
    try {
        const supabase = await createServiceRoleClient();
        const { data, error } = await supabase
            .from('promotions')
            .select('*')
            .eq('show_on_home', true)
            .eq('is_active', true)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching home promotions:', error);
            return { data: null, error: error.message };
        }

        const now = new Date();
        const active = (data || [])
            .map(normalizePromotion)
            .filter((p) => isPromotionActiveNow(p, now, timeZone));

        return { data: active, error: null };
    } catch (err) {
        console.error('Unexpected error fetching home promotions:', err);
        return { data: null, error: 'An unexpected error occurred' };
    }
}

export async function createPromotion(input: {
    title: string;
    description?: string;
    is_active?: boolean;
    applies_to: Promotion['applies_to'];
    discount_type: Promotion['discount_type'];
    discount_value: number;
    starts_at?: string | null;
    ends_at?: string | null;
    days_of_week?: number[] | null;
    daily_start_minute?: number | null;
    daily_end_minute?: number | null;
    product_scope?: Promotion['product_scope'];
    min_product_price?: number | null;
    cart_scope?: Promotion['cart_scope'];
    min_cart_subtotal?: number | null;
    show_on_home?: boolean;
    home_title?: string | null;
    priority?: number;
    product_ids?: string[];
}): Promise<{ data: PromotionWithProducts | null; error: string | null }> {
    try {
        const supabase = await createServiceRoleClient();

        const { data, error } = await supabase
            .from('promotions')
            .insert([
                {
                    title: input.title,
                    description: input.description ?? null,
                    is_active: input.is_active ?? true,
                    applies_to: input.applies_to,
                    discount_type: input.discount_type,
                    discount_value: input.discount_value,
                    starts_at: input.starts_at ?? null,
                    ends_at: input.ends_at ?? null,
                    days_of_week: input.days_of_week ?? null,
                    daily_start_minute: input.daily_start_minute ?? null,
                    daily_end_minute: input.daily_end_minute ?? null,
                    product_scope: input.product_scope ?? 'all',
                    min_product_price: input.min_product_price ?? null,
                    cart_scope: input.cart_scope ?? 'all',
                    min_cart_subtotal: input.min_cart_subtotal ?? null,
                    show_on_home: input.show_on_home ?? false,
                    home_title: input.home_title ?? null,
                    priority: input.priority ?? 0,
                },
            ])
            .select('*')
            .single();

        if (error) {
            console.error('Error creating promotion:', error);
            return { data: null, error: error.message };
        }

        const promo = normalizePromotion(data);

        const productIds = input.product_ids ?? [];
        if (productIds.length > 0) {
            const { error: joinError } = await supabase
                .from('promotion_products')
                .insert(productIds.map((sale_product_id) => ({ promotion_id: promo.id, sale_product_id })));

            if (joinError) {
                console.error('Error creating promotion_products:', joinError);
                return { data: null, error: joinError.message };
            }
        }

        return { data: { ...promo, product_ids: productIds }, error: null };
    } catch (err) {
        console.error('Unexpected error creating promotion:', err);
        return { data: null, error: 'An unexpected error occurred' };
    }
}

export async function updatePromotion(
    id: string,
    input: {
        title: string;
        description?: string;
        is_active?: boolean;
        applies_to: Promotion['applies_to'];
        discount_type: Promotion['discount_type'];
        discount_value: number;
        starts_at?: string | null;
        ends_at?: string | null;
        days_of_week?: number[] | null;
        daily_start_minute?: number | null;
        daily_end_minute?: number | null;
        product_scope?: Promotion['product_scope'];
        min_product_price?: number | null;
        cart_scope?: Promotion['cart_scope'];
        min_cart_subtotal?: number | null;
        show_on_home?: boolean;
        home_title?: string | null;
        priority?: number;
        product_ids?: string[];
    }
): Promise<{ data: PromotionWithProducts | null; error: string | null }> {
    try {
        const supabase = await createServiceRoleClient();

        const { data, error } = await supabase
            .from('promotions')
            .update({
                title: input.title,
                description: input.description ?? null,
                is_active: input.is_active ?? true,
                applies_to: input.applies_to,
                discount_type: input.discount_type,
                discount_value: input.discount_value,
                starts_at: input.starts_at ?? null,
                ends_at: input.ends_at ?? null,
                days_of_week: input.days_of_week ?? null,
                daily_start_minute: input.daily_start_minute ?? null,
                daily_end_minute: input.daily_end_minute ?? null,
                product_scope: input.product_scope ?? 'all',
                min_product_price: input.min_product_price ?? null,
                cart_scope: input.cart_scope ?? 'all',
                min_cart_subtotal: input.min_cart_subtotal ?? null,
                show_on_home: input.show_on_home ?? false,
                home_title: input.home_title ?? null,
                priority: input.priority ?? 0,
            })
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('Error updating promotion:', error);
            return { data: null, error: error.message };
        }

        // Refresh join table
        const productIds = input.product_ids ?? [];
        await supabase.from('promotion_products').delete().eq('promotion_id', id);
        if (productIds.length > 0) {
            const { error: joinError } = await supabase
                .from('promotion_products')
                .insert(productIds.map((sale_product_id) => ({ promotion_id: id, sale_product_id })));

            if (joinError) {
                console.error('Error updating promotion_products:', joinError);
                return { data: null, error: joinError.message };
            }
        }

        const promo = normalizePromotion(data);
        return { data: { ...promo, product_ids: productIds }, error: null };
    } catch (err) {
        console.error('Unexpected error updating promotion:', err);
        return { data: null, error: 'An unexpected error occurred' };
    }
}

export async function deletePromotion(id: string): Promise<{ error: string | null }> {
    try {
        const supabase = await createServiceRoleClient();
        const { error } = await supabase.from('promotions').delete().eq('id', id);
        if (error) {
            console.error('Error deleting promotion:', error);
            return { error: error.message };
        }
        return { error: null };
    } catch (err) {
        console.error('Unexpected error deleting promotion:', err);
        return { error: 'An unexpected error occurred' };
    }
}
