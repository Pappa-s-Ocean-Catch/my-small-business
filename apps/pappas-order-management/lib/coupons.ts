import { supabase } from './supabase';

export type PromotionDiscountType = 'percent' | 'fixed';

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
  errorMessage?: string;
  discountAmount: number;
}

export function computeDiscountAmount(type: PromotionDiscountType, value: number, cartSubtotal: number): number {
  if (cartSubtotal <= 0) return 0;
  if (type === 'percent') {
    return Math.min(cartSubtotal, (cartSubtotal * value) / 100);
  }
  return Math.min(cartSubtotal, value);
}

export function clampCurrency(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100) / 100);
}

export function getCouponErrorMessage(error?: CouponValidationError, minSubtotal?: number): string {
  switch (error) {
    case 'not_found':
      return 'Coupon code not found.';
    case 'inactive':
      return 'This coupon is no longer active.';
    case 'expired':
      return 'This coupon has expired.';
    case 'not_started':
      return 'This coupon is not yet active.';
    case 'usage_limit_reached':
      return 'This coupon has reached its maximum usage limit.';
    case 'user_limit_reached':
      return 'This customer has already used this coupon maximum times.';
    case 'wrong_user':
      return 'This coupon is restricted to a specific customer.';
    case 'already_used':
      return 'This coupon code has already been redeemed.';
    case 'subtotal_too_low':
      return minSubtotal && minSubtotal > 0
        ? `Order subtotal must be at least $${minSubtotal.toFixed(2)} to use this coupon.`
        : 'Your order subtotal is too low for this coupon.';
    default:
      return 'Invalid coupon code.';
  }
}

export function validateCoupon(params: {
  coupon: Coupon;
  userId?: string | null;
  customerEmail?: string | null;
  cartSubtotal: number;
  userRedemptionCount?: number;
  ignoreUserMismatch?: boolean;
}): CouponValidationResult {
  const { coupon, userId, customerEmail, cartSubtotal, userRedemptionCount = 0, ignoreUserMismatch = false } = params;
  const now = new Date();

  // 1. Check if active
  if (!coupon.is_active) {
    return { isValid: false, coupon, error: 'inactive', errorMessage: getCouponErrorMessage('inactive'), discountAmount: 0 };
  }

  // 2. Check date window
  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    return { isValid: false, coupon, error: 'not_started', errorMessage: getCouponErrorMessage('not_started'), discountAmount: 0 };
  }

  if (coupon.ends_at && new Date(coupon.ends_at) < now) {
    return { isValid: false, coupon, error: 'expired', errorMessage: getCouponErrorMessage('expired'), discountAmount: 0 };
  }

  // 3. Check global usage limit
  if (coupon.max_uses != null && coupon.usage_count >= coupon.max_uses) {
    return { isValid: false, coupon, error: 'usage_limit_reached', errorMessage: getCouponErrorMessage('usage_limit_reached'), discountAmount: 0 };
  }

  // 4. Check per-user limit if customer is known
  if (coupon.max_uses_per_user != null && userRedemptionCount >= coupon.max_uses_per_user) {
    return { isValid: false, coupon, error: 'user_limit_reached', errorMessage: getCouponErrorMessage('user_limit_reached'), discountAmount: 0 };
  }

  // 5. User targeting (skipped when ignoreUserMismatch is true, e.g. in POS where targeted customer will be auto-linked)
  if (!ignoreUserMismatch) {
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
      return { isValid: false, coupon, error: 'wrong_user', errorMessage: getCouponErrorMessage('wrong_user'), discountAmount: 0 };
    }
  }

  // 6. Cart conditions
  const minSubtotal = Number(coupon.min_cart_subtotal ?? 0) || 0;
  if (cartSubtotal < minSubtotal) {
    return { isValid: false, coupon, error: 'subtotal_too_low', errorMessage: getCouponErrorMessage('subtotal_too_low', minSubtotal), discountAmount: 0 };
  }

  // 7. Calculate discount
  const amount = computeDiscountAmount(coupon.discount_type, Number(coupon.discount_value || 0), cartSubtotal);

  return {
    isValid: true,
    coupon,
    discountAmount: clampCurrency(amount),
  };
}

/**
 * Fetch coupon from database by code and validate against current cart & customer
 */
export async function validateCouponCode(params: {
  code: string;
  cartSubtotal: number;
  userId?: string | null;
  customerEmail?: string | null;
  ignoreUserMismatch?: boolean;
}): Promise<CouponValidationResult> {
  const { code, cartSubtotal, userId, customerEmail, ignoreUserMismatch = true } = params;
  const cleanCode = code.trim().toUpperCase();

  if (!cleanCode) {
    return { isValid: false, coupon: null, error: 'not_found', errorMessage: 'Please enter a coupon code.', discountAmount: 0 };
  }

  try {
    const { data: couponData, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .ilike('code', cleanCode)
      .maybeSingle();

    if (couponError || !couponData) {
      return { isValid: false, coupon: null, error: 'not_found', errorMessage: getCouponErrorMessage('not_found'), discountAmount: 0 };
    }

    const coupon: Coupon = {
      ...couponData,
      discount_value: Number(couponData.discount_value ?? 0),
      min_cart_subtotal: Number(couponData.min_cart_subtotal ?? 0),
      usage_count: Number(couponData.usage_count ?? 0),
    };

    let userRedemptionCount = 0;
    const targetUserId = userId || coupon.user_id;
    if (targetUserId) {
      const { count } = await supabase
        .from('coupon_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('user_id', targetUserId);
      userRedemptionCount = count ?? 0;
    }

    return validateCoupon({
      coupon,
      userId,
      customerEmail,
      cartSubtotal,
      userRedemptionCount,
      ignoreUserMismatch,
    });
  } catch (err: any) {
    console.error('Error validating coupon code:', err);
    return {
      isValid: false,
      coupon: null,
      error: 'not_found',
      errorMessage: err?.message || 'Failed to validate coupon.',
      discountAmount: 0,
    };
  }
}

/**
 * Record coupon redemption and increment coupon usage count
 */
export async function recordCouponRedemption(params: {
  couponId: string;
  orderId: string;
  userId?: string | null;
}): Promise<{ success: boolean; error: string | null }> {
  const { couponId, orderId, userId } = params;
  try {
    // 1. Insert redemption
    const { error: redemptionError } = await supabase
      .from('coupon_redemptions')
      .insert({
        coupon_id: couponId,
        order_id: orderId,
        user_id: userId ?? null,
      });

    if (redemptionError) {
      console.warn('Error inserting coupon redemption record:', redemptionError.message);
    }

    // 2. Increment usage_count
    const { data: coupon } = await supabase
      .from('coupons')
      .select('usage_count')
      .eq('id', couponId)
      .single();

    const currentCount = Number(coupon?.usage_count ?? 0);
    const { error: updateError } = await supabase
      .from('coupons')
      .update({
        usage_count: currentCount + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', couponId);

    if (updateError) {
      console.warn('Error updating coupon usage_count:', updateError.message);
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Error recording coupon redemption:', err);
    return { success: false, error: err?.message || 'Failed to record coupon redemption' };
  }
}

/**
 * Get coupons list for management page with pagination support
 */
export async function getCouponsList(params?: {
  searchQuery?: string;
  filter?: 'all' | 'active' | 'inactive' | 'expired';
  page?: number;
  pageSize?: number;
}): Promise<{
  data: Coupon[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  error: string | null;
}> {
  try {
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.max(1, params?.pageSize ?? 10);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('coupons')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params?.searchQuery) {
      const q = `%${params.searchQuery.trim()}%`;
      query = query.or(`code.ilike.${q},title.ilike.${q},description.ilike.${q}`);
    }

    if (params?.filter === 'active') {
      query = query.eq('is_active', true);
    } else if (params?.filter === 'inactive') {
      query = query.eq('is_active', false);
    } else if (params?.filter === 'expired') {
      query = query.lt('ends_at', new Date().toISOString());
    }

    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      return { data: [], totalCount: 0, totalPages: 1, page, pageSize, error: error.message };
    }

    const coupons: Coupon[] = (data || []).map((item) => ({
      ...item,
      discount_value: Number(item.discount_value ?? 0),
      min_cart_subtotal: Number(item.min_cart_subtotal ?? 0),
      usage_count: Number(item.usage_count ?? 0),
    }));

    const totalCount = count ?? coupons.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return { data: coupons, totalCount, totalPages, page, pageSize, error: null };
  } catch (err: any) {
    console.error('Error fetching coupons list:', err);
    return { data: [], totalCount: 0, totalPages: 1, page: 1, pageSize: 10, error: err?.message || 'Failed to fetch coupons' };
  }
}

/**
 * Toggle coupon active status
 */
export async function toggleCouponActive(couponId: string, isActive: boolean): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('coupons')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', couponId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Error toggling coupon status:', err);
    return { success: false, error: err?.message || 'Failed to update coupon status' };
  }
}

export type CustomerCouponItem = {
  coupon: Coupon;
  status: 'active' | 'inactive' | 'expired' | 'redeemed' | 'not_started';
  statusLabel: string;
  userRedemptionsCount: number;
};

/**
 * Fetch coupons associated with or available for a customer
 */
export async function getCustomerCoupons(params: {
  userId?: string | null;
  customerEmail?: string | null;
}): Promise<{ data: CustomerCouponItem[]; error: string | null }> {
  const { userId, customerEmail } = params;
  if (!userId && !customerEmail) {
    return { data: [], error: null };
  }

  try {
    // Fetch coupons targeted to user or all coupons
    const { data: allCoupons, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Fetch redemptions by user
    let redemptions: Array<{ coupon_id: string }> = [];
    if (userId) {
      const { data: redData } = await supabase
        .from('coupon_redemptions')
        .select('coupon_id')
        .eq('user_id', userId);
      redemptions = redData || [];
    }

    const redemptionCountsMap = new Map<string, number>();
    redemptions.forEach((r) => {
      redemptionCountsMap.set(r.coupon_id, (redemptionCountsMap.get(r.coupon_id) || 0) + 1);
    });

    const now = new Date();
    const result: CustomerCouponItem[] = [];

    for (const raw of allCoupons || []) {
      const coupon: Coupon = {
        ...raw,
        discount_value: Number(raw.discount_value ?? 0),
        min_cart_subtotal: Number(raw.min_cart_subtotal ?? 0),
        usage_count: Number(raw.usage_count ?? 0),
      };

      const userRedemptions = redemptionCountsMap.get(coupon.id) || 0;
      const isTargeted =
        (coupon.user_id && coupon.user_id === userId) ||
        (coupon.target_email && customerEmail && coupon.target_email.toLowerCase() === customerEmail.toLowerCase());

      // If targeted or has redemptions or general coupon
      if (isTargeted || userRedemptions > 0 || (!coupon.user_id && !coupon.target_email)) {
        let status: CustomerCouponItem['status'] = 'active';
        let statusLabel = 'Active';

        if (!coupon.is_active) {
          status = 'inactive';
          statusLabel = 'Inactive';
        } else if (coupon.ends_at && new Date(coupon.ends_at) < now) {
          status = 'expired';
          statusLabel = 'Expired';
        } else if (coupon.starts_at && new Date(coupon.starts_at) > now) {
          status = 'not_started';
          statusLabel = 'Starts Soon';
        } else if (coupon.max_uses_per_user != null && userRedemptions >= coupon.max_uses_per_user) {
          status = 'redeemed';
          statusLabel = 'Used / Redeemed';
        } else if (coupon.max_uses != null && coupon.usage_count >= coupon.max_uses) {
          status = 'expired';
          statusLabel = 'Max Uses Reached';
        }

        result.push({
          coupon,
          status,
          statusLabel,
          userRedemptionsCount: userRedemptions,
        });
      }
    }

    return { data: result, error: null };
  } catch (err: any) {
    console.error('Error fetching customer coupons:', err);
    return { data: [], error: err?.message || 'Failed to fetch customer coupons' };
  }
}
