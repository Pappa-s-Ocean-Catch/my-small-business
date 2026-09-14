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
    kind?: 'standard' | 'free_item';
    selected_item_id?: string;
    selected_item_name?: string;
    threshold?: number | null;
};

export type CartPromotionItem = {
    id?: string;
    product_id: string;
    base_price: number;
    quantity: number;
    subtotal: number;
    name?: string;
};

export type FreeItemPromotionMatch = {
    promotion: PromotionWithProducts;
    item: CartPromotionItem;
    unitPrice: number;
    discountAmount: number;
};

export type FreeItemEncouragement = {
    promotion: PromotionWithProducts;
    remainingAmount: number;
    progressRatio: number;
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

function formatThresholdAmount(amount: number | null | undefined): string | null {
    const value = Number(amount ?? 0);
    if (!(value > 0)) return null;
    return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
}

export function isFreeItemPromotion(promo: PromotionWithProducts): boolean {
    return promo.applies_to === 'cart' && Array.isArray(promo.product_ids) && promo.product_ids.length > 0;
}

export function getFreeItemDisplayName(
    promo: Pick<Promotion, 'min_cart_subtotal'>,
    itemName: string
): string {
    const threshold = formatThresholdAmount(promo.min_cart_subtotal);
    if (threshold) {
        return `FREE ${itemName} on orders over $${threshold}`;
    }
    return `FREE ${itemName}`;
}

export function getPromotionDisplayTitle(promo: PromotionWithProducts | Promotion): string {
    if ('product_ids' in promo && isFreeItemPromotion(promo as PromotionWithProducts)) {
        return promo.title || 'Free item';
    }
    return promo.title;
}

export function getPromotionDetailsCopy(promo: PromotionWithProducts | Promotion): string {
    const maybeWithProducts = promo as PromotionWithProducts;
    if (isFreeItemPromotion(maybeWithProducts)) {
        const threshold = Number(promo.min_cart_subtotal ?? 0) || 0;
        if (threshold > 0) {
            return `Spend $${threshold.toFixed(2)} or more after discounts to unlock 1 free eligible item. Delivery fee is excluded.`;
        }
        return 'Add 1 eligible item to your cart and it will be free. Delivery fee is excluded.';
    }

    if (promo.applies_to === 'cart' && promo.cart_scope === 'subtotal_min' && typeof promo.min_cart_subtotal === 'number') {
        return `Spend $${promo.min_cart_subtotal.toFixed(2)} or more and get ${promotionLabel(promo)}. Delivery fee is excluded.`;
    }

    return `${promotionLabel(promo)}. Delivery fee is excluded.`;
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

export function findSelectedFreeItemPromotion(params: {
    promotions: PromotionWithProducts[];
    items: CartPromotionItem[];
    cartSubtotal: number;
    selectedItemId?: string | null;
}): FreeItemPromotionMatch | null {
    const { promotions, items, cartSubtotal, selectedItemId } = params;
    if (!selectedItemId) return null;

    const selectedItem = items.find((item) => item.id === selectedItemId);
    if (!selectedItem) return null;

    let best: FreeItemPromotionMatch | null = null;

    for (const promotion of promotions) {
        if (!isFreeItemPromotion(promotion)) continue;
        if (!appliesToCart(promotion, cartSubtotal)) continue;
        if (!(promotion.product_ids || []).includes(selectedItem.product_id)) continue;

        const quantity = Math.max(1, Number(selectedItem.quantity) || 1);
        const unitPrice = clampCurrency((Number(selectedItem.subtotal) || 0) / quantity);
        if (unitPrice <= 0) continue;

        const configuredCap = Number(promotion.discount_value || 0);
        const discountAmount = clampCurrency(
            configuredCap > 0 ? Math.min(unitPrice, configuredCap) : unitPrice
        );
        if (discountAmount <= 0) continue;

        if (
            !best
            || discountAmount > best.discountAmount + 0.0001
            || (
                Math.abs(discountAmount - best.discountAmount) < 0.0001
                && (promotion.priority ?? 0) > (best.promotion.priority ?? 0)
            )
        ) {
            best = {
                promotion,
                item: selectedItem,
                unitPrice,
                discountAmount,
            };
        }
    }

    return best;
}

export function pickUnlockedFreeItemPromotion(
    promotions: PromotionWithProducts[],
    cartSubtotal: number
): PromotionWithProducts | null {
    let best: PromotionWithProducts | null = null;

    for (const promotion of promotions) {
        if (!isFreeItemPromotion(promotion)) continue;
        if (!appliesToCart(promotion, cartSubtotal)) continue;

        if (
            !best
            || (promotion.priority ?? 0) > (best.priority ?? 0)
            || (
                (promotion.priority ?? 0) === (best.priority ?? 0)
                && (Number(promotion.min_cart_subtotal ?? 0) || 0) > (Number(best.min_cart_subtotal ?? 0) || 0)
            )
        ) {
            best = promotion;
        }
    }

    return best;
}

export function findFreeItemEncouragement(params: {
    promotions: PromotionWithProducts[];
    items: CartPromotionItem[];
    cartSubtotal: number;
    triggerRatio?: number;
}): FreeItemEncouragement | null {
    const { promotions, items, cartSubtotal, triggerRatio = 0.8 } = params;

    let productDiscount = 0;
    for (const item of items) {
        const { promo, discountPerUnit } = pickBestProductPromotion(promotions, {
            id: item.product_id,
            sale_price: Number(item.base_price) || 0,
        });

        if (!promo || discountPerUnit <= 0) continue;
        const itemDiscount = clampCurrency(discountPerUnit * Math.max(1, Number(item.quantity) || 1));
        if (itemDiscount <= 0) continue;
        productDiscount = clampCurrency(productDiscount + itemDiscount);
    }

    const eligibleSubtotal = clampCurrency(Math.max(0, cartSubtotal - productDiscount));
    let best: FreeItemEncouragement | null = null;

    for (const promotion of promotions) {
        if (!isFreeItemPromotion(promotion)) continue;

        const threshold = Number(promotion.min_cart_subtotal ?? 0) || 0;
        if (threshold <= 0) continue;
        if (eligibleSubtotal >= threshold) continue;

        const progressRatio = eligibleSubtotal / threshold;
        if (progressRatio < triggerRatio) continue;

        const remainingAmount = clampCurrency(Math.max(0, threshold - eligibleSubtotal));
        if (
            !best
            || (promotion.priority ?? 0) > (best.promotion.priority ?? 0)
            || (
                (promotion.priority ?? 0) === (best.promotion.priority ?? 0)
                && threshold < (Number(best.promotion.min_cart_subtotal ?? 0) || 0)
            )
        ) {
            best = {
                promotion,
                remainingAmount,
                progressRatio,
            };
        }
    }

    return best;
}

export function computeCartPromotionTotals(params: {
    promotions: PromotionWithProducts[];
    items: CartPromotionItem[];
    cartSubtotal: number;
    selectedFreeItemId?: string | null;
}): {
    productDiscount: number;
    cartDiscount: number;
    totalDiscount: number;
    subtotalAfterPromotions: number;
    applied: AppliedPromotion[];
    freeItemPromotion: FreeItemPromotionMatch | null;
    unlockedFreeItemPromotion: PromotionWithProducts | null;
    freeItemSelectionRequired: boolean;
} {
    const { promotions, items, cartSubtotal, selectedFreeItemId } = params;
    const selectedFreeItem = selectedFreeItemId
        ? items.find((item) => item.id === selectedFreeItemId) ?? null
        : null;

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
    const qualifyingCartSubtotal = clampCurrency(
        Math.max(0, eligibleForCartPromo - (Number(selectedFreeItem?.subtotal) || 0))
    );
    const freeItemPromotion = findSelectedFreeItemPromotion({
        promotions,
        items,
        cartSubtotal: qualifyingCartSubtotal,
        selectedItemId: selectedFreeItemId,
    });
    const unlockedFreeItemPromotion = pickUnlockedFreeItemPromotion(promotions, qualifyingCartSubtotal);
    const standardCartPromotions = promotions.filter((promotion) => !isFreeItemPromotion(promotion));
    const { promo: cartPromo, discountAmount: standardCartDiscount } = pickBestCartPromotion(standardCartPromotions, eligibleForCartPromo);
    const cartDiscount = freeItemPromotion?.discountAmount ?? standardCartDiscount;
    const selectedCartPromo = freeItemPromotion?.promotion ?? cartPromo;

    if (selectedCartPromo && cartDiscount > 0) {
        applied.push({
            id: selectedCartPromo.id,
            title: selectedCartPromo.title,
            applies_to: 'cart',
            amount: cartDiscount,
            kind: freeItemPromotion ? 'free_item' : 'standard',
            selected_item_id: freeItemPromotion?.item.id,
            selected_item_name: freeItemPromotion
                ? getFreeItemDisplayName(selectedCartPromo, freeItemPromotion.item.name ?? 'Eligible item')
                : undefined,
            threshold: selectedCartPromo.min_cart_subtotal ?? null,
        });
    }

    const totalDiscount = clampCurrency(Math.min(cartSubtotal, productDiscount + cartDiscount));
    const subtotalAfterPromotions = clampCurrency(Math.max(0, cartSubtotal - totalDiscount));
    const freeItemSelectionRequired = !!unlockedFreeItemPromotion && !freeItemPromotion;

    return {
        productDiscount: clampCurrency(productDiscount),
        cartDiscount: clampCurrency(cartDiscount),
        totalDiscount,
        subtotalAfterPromotions,
        applied,
        freeItemPromotion,
        unlockedFreeItemPromotion,
        freeItemSelectionRequired,
    };
}
