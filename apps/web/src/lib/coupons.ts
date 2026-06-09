import { 
    type PromotionDiscountType, 
    computeDiscountAmount, 
    clampCurrency 
} from './promotions';

export interface Coupon {
    id: string;
    code: string;
    title: string;
    description: string | null;
    is_active: boolean;
    discount_type: PromotionDiscountType;
    discount_value: number;
    starts_at: string | null;
    ends_at: string | null;
    max_uses: number | null;
    usage_count: number;
    max_uses_per_user: number | null;
    user_id: string | null;
    target_email: string | null;
    min_cart_subtotal: number;
    created_at: string;
    updated_at: string;
}

export type CouponValidationError = 
    | 'not_found'
    | 'inactive'
    | 'expired'
    | 'not_started'
    | 'usage_limit_reached'
    | 'user_limit_reached'
    | 'wrong_user'
    | 'subtotal_too_low'
    | 'already_used';

export interface CouponValidationResult {
    isValid: boolean;
    coupon: Coupon | null;
    error?: CouponValidationError;
    discountAmount: number;
}

/**
 * Validates a coupon against current cart and user context.
 * Note: Per-user usage check should be done on the server.
 */
export function validateCoupon(params: {
    coupon: Coupon;
    userId?: string | null;
    customerEmail?: string | null;
    cartSubtotal: number;
    userRedemptionCount?: number; // How many times THIS user has used THIS coupon
}): CouponValidationResult {
    const { coupon, userId, customerEmail, cartSubtotal, userRedemptionCount = 0 } = params;

    // 1. Basic status
    if (!coupon.is_active) {
        return { isValid: false, coupon, error: 'inactive', discountAmount: 0 };
    }

    // 2. Date windows
    const now = new Date();
    if (coupon.starts_at) {
        const starts = new Date(coupon.starts_at);
        if (now < starts) return { isValid: false, coupon, error: 'not_started', discountAmount: 0 };
    }
    if (coupon.ends_at) {
        const ends = new Date(coupon.ends_at);
        if (now > ends) return { isValid: false, coupon, error: 'expired', discountAmount: 0 };
    }

    // 3. Overall usage limit
    if (coupon.max_uses != null && coupon.usage_count >= coupon.max_uses) {
        return { isValid: false, coupon, error: 'usage_limit_reached', discountAmount: 0 };
    }

    // 4. Per-user limit
    if (coupon.max_uses_per_user != null && userRedemptionCount >= coupon.max_uses_per_user) {
        return { isValid: false, coupon, error: 'user_limit_reached', discountAmount: 0 };
    }

    // 5. User targeting
    let userMatches = false;
    let emailMatches = false;

    if (!coupon.user_id && !coupon.target_email) {
        userMatches = true;
        emailMatches = true;
    } else {
        if (coupon.user_id && userId === coupon.user_id) userMatches = true;
        if (coupon.target_email && customerEmail?.toLowerCase() === coupon.target_email.toLowerCase()) emailMatches = true;
    }

    if (!userMatches && !emailMatches) {
        return { isValid: false, coupon, error: 'wrong_user', discountAmount: 0 };
    }

    // 6. Cart conditions
    if (cartSubtotal < coupon.min_cart_subtotal) {
        return { isValid: false, coupon, error: 'subtotal_too_low', discountAmount: 0 };
    }

    // 7. Calculate discount
    const amount = computeDiscountAmount(coupon.discount_type, coupon.discount_value, cartSubtotal);

    return {
        isValid: true,
        coupon,
        discountAmount: clampCurrency(amount),
    };
}

export function getCouponErrorMessage(error?: CouponValidationError): string {
    switch (error) {
        case 'not_found': return 'Coupon code not found.';
        case 'inactive': return 'This coupon is no longer active.';
        case 'expired': return 'This coupon has expired.';
        case 'not_started': return 'This coupon is not yet active.';
        case 'usage_limit_reached': return 'This coupon has reached its maximum usage limit.';
        case 'user_limit_reached': return 'You have already used this coupon.';
        case 'wrong_user': return 'This coupon is not valid for your account.';
        case 'already_used': return 'You have already used this coupon code.';
        case 'subtotal_too_low': return 'Your order subtotal is too low for this coupon.';
        default: return 'Invalid coupon code.';
    }
}
