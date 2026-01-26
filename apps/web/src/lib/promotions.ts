export type PromotionAppliesTo = 'product' | 'cart';
export type PromotionDiscountType = 'percent' | 'fixed';
export type PromotionProductScope = 'all' | 'specific' | 'min_price';
export type PromotionCartScope = 'all' | 'subtotal_min';

export interface Promotion {
    id: string;
    title: string;
    description: string | null;
    is_active: boolean;
    applies_to: PromotionAppliesTo;
    discount_type: PromotionDiscountType;
    discount_value: number;
    starts_at: string | null;
    ends_at: string | null;
    days_of_week: number[] | null;
    daily_start_minute: number | null;
    daily_end_minute: number | null;
    product_scope: PromotionProductScope;
    min_product_price: number | null;
    cart_scope: PromotionCartScope;
    min_cart_subtotal: number | null;
    show_on_home: boolean;
    home_title: string | null;
    priority: number;
    created_at: string;
    updated_at: string;
}

export interface PromotionWithProducts extends Promotion {
    product_ids?: string[];
}

export type AppliedPromotion = {
    id: string;
    title: string;
    applies_to: PromotionAppliesTo;
    amount: number;
};

export const DEFAULT_STORE_TIMEZONE = 'Australia/Melbourne';

export function clampCurrency(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n * 100) / 100);
}

export function computeDiscountAmount(
    discountType: PromotionDiscountType,
    discountValue: number,
    amount: number
): number {
    const base = Math.max(0, Number(amount) || 0);
    const value = Math.max(0, Number(discountValue) || 0);

    if (base <= 0 || value <= 0) return 0;

    if (discountType === 'percent') {
        const pct = Math.min(100, value);
        return clampCurrency(Math.min(base, (base * pct) / 100));
    }

    return clampCurrency(Math.min(base, value));
}

function getZonedParts(date: Date, timeZone: string): { weekday: number; hour: number; minute: number } {
    // weekday: 0=Sun..6=Sat
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const weekdayPart = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
    const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minutePart = parts.find((p) => p.type === 'minute')?.value ?? '00';

    const weekdayMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
    };

    return {
        weekday: weekdayMap[weekdayPart] ?? 0,
        hour: Number(hourPart) || 0,
        minute: Number(minutePart) || 0,
    };
}

export function isPromotionActiveNow(
    promo: Pick<
        Promotion,
        'is_active' | 'starts_at' | 'ends_at' | 'days_of_week' | 'daily_start_minute' | 'daily_end_minute'
    >,
    now: Date = new Date(),
    timeZone: string = DEFAULT_STORE_TIMEZONE
): boolean {
    if (!promo.is_active) return false;

    if (promo.starts_at) {
        const starts = new Date(promo.starts_at);
        if (!Number.isNaN(starts.getTime()) && now < starts) return false;
    }

    if (promo.ends_at) {
        const ends = new Date(promo.ends_at);
        if (!Number.isNaN(ends.getTime()) && now > ends) return false;
    }

    const { weekday, hour, minute } = getZonedParts(now, timeZone);

    if (promo.days_of_week && promo.days_of_week.length > 0) {
        if (!promo.days_of_week.includes(weekday)) return false;
    }

    const startMin = promo.daily_start_minute;
    const endMin = promo.daily_end_minute;
    if (startMin != null && endMin != null) {
        const nowMin = hour * 60 + minute;

        // Normal window
        if (startMin <= endMin) {
            if (nowMin < startMin || nowMin > endMin) return false;
        } else {
            // Window spans midnight (e.g. 22:00-02:00)
            const inLate = nowMin >= startMin;
            const inEarly = nowMin <= endMin;
            if (!inLate && !inEarly) return false;
        }
    }

    return true;
}

export function promotionLabel(promo: Pick<Promotion, 'discount_type' | 'discount_value'>): string {
    if (promo.discount_type === 'percent') return `${promo.discount_value}% off`;
    return `$${Number(promo.discount_value || 0).toFixed(2)} off`;
}

export function appliesToProduct(
    promo: PromotionWithProducts,
    product: { id: string; sale_price: number }
): boolean {
    if (promo.applies_to !== 'product') return false;

    const price = Number(product.sale_price) || 0;

    if (promo.product_scope === 'min_price') {
        const min = Number(promo.min_product_price ?? 0) || 0;
        return price >= min;
    }

    if (promo.product_scope === 'specific') {
        const ids = promo.product_ids || [];
        return ids.includes(product.id);
    }

    return true; // all
}

export function appliesToCart(
    promo: Promotion,
    cartSubtotal: number
): boolean {
    if (promo.applies_to !== 'cart') return false;

    const subtotal = Number(cartSubtotal) || 0;

    if (promo.cart_scope === 'subtotal_min') {
        const min = Number(promo.min_cart_subtotal ?? 0) || 0;
        return subtotal >= min;
    }

    return true;
}

export function pickBestProductPromotion(
    promos: PromotionWithProducts[],
    product: { id: string; sale_price: number }
): { promo: PromotionWithProducts | null; discountPerUnit: number } {
    let best: PromotionWithProducts | null = null;
    let bestAmount = 0;

    for (const p of promos) {
        if (p.applies_to !== 'product') continue;
        if (!appliesToProduct(p, product)) continue;

        const amount = computeDiscountAmount(p.discount_type, p.discount_value, product.sale_price);
        if (amount > bestAmount + 0.0001) {
            best = p;
            bestAmount = amount;
        } else if (Math.abs(amount - bestAmount) < 0.0001 && best && p.priority > best.priority) {
            best = p;
        }
    }

    return { promo: best, discountPerUnit: clampCurrency(bestAmount) };
}

export function pickBestCartPromotion(
    promos: PromotionWithProducts[],
    cartSubtotal: number
): { promo: PromotionWithProducts | null; discountAmount: number } {
    let best: PromotionWithProducts | null = null;
    let bestAmount = 0;

    for (const p of promos) {
        if (p.applies_to !== 'cart') continue;
        if (!appliesToCart(p, cartSubtotal)) continue;

        const amount = computeDiscountAmount(p.discount_type, p.discount_value, cartSubtotal);
        if (amount > bestAmount + 0.0001) {
            best = p;
            bestAmount = amount;
        } else if (Math.abs(amount - bestAmount) < 0.0001 && best && p.priority > best.priority) {
            best = p;
        }
    }

    return { promo: best, discountAmount: clampCurrency(bestAmount) };
}

export function computeCartPromotionTotals(params: {
    promotions: PromotionWithProducts[];
    items: Array<{ product_id: string; base_price: number; quantity: number; subtotal: number }>;
    cartSubtotal: number;
}): {
    productDiscount: number;
    cartDiscount: number;
    totalDiscount: number;
    subtotalAfterPromotions: number;
    applied: AppliedPromotion[];
} {
    const { promotions, items, cartSubtotal } = params;

    let productDiscount = 0;
    const applied: AppliedPromotion[] = [];

    for (const item of items) {
        const { promo, discountPerUnit } = pickBestProductPromotion(promotions, {
            id: item.product_id,
            sale_price: Number(item.base_price) || 0,
        });

        if (!promo || discountPerUnit <= 0) continue;
        const itemDiscount = clampCurrency(discountPerUnit * Math.max(1, Number(item.quantity) || 1));
        if (itemDiscount <= 0) continue;

        productDiscount = clampCurrency(productDiscount + itemDiscount);
        applied.push({ id: promo.id, title: promo.title, applies_to: 'product', amount: itemDiscount });
    }

    const eligibleForCartPromo = clampCurrency(Math.max(0, cartSubtotal - productDiscount));
    const { promo: cartPromo, discountAmount: cartDiscount } = pickBestCartPromotion(promotions, eligibleForCartPromo);

    if (cartPromo && cartDiscount > 0) {
        applied.push({ id: cartPromo.id, title: cartPromo.title, applies_to: 'cart', amount: cartDiscount });
    }

    const totalDiscount = clampCurrency(Math.min(cartSubtotal, productDiscount + cartDiscount));
    const subtotalAfterPromotions = clampCurrency(Math.max(0, cartSubtotal - totalDiscount));

    return {
        productDiscount: clampCurrency(productDiscount),
        cartDiscount: clampCurrency(cartDiscount),
        totalDiscount,
        subtotalAfterPromotions,
        applied,
    };
}
