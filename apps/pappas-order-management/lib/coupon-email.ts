import { supabase } from './supabase';
import { getApiUrl } from '../utils/orderUtils';
import type { Coupon } from './coupons';

export function canEmailCoupon(coupon: Coupon, now = Date.now()): boolean {
  return coupon.is_active
    && (!coupon.starts_at || Date.parse(coupon.starts_at) <= now)
    && (!coupon.ends_at || Date.parse(coupon.ends_at) > now)
    && (coupon.max_uses == null || coupon.usage_count < coupon.max_uses)
    && (coupon.max_uses_per_user == null || coupon.max_uses_per_user > 0)
    && !!(coupon.user_id || coupon.target_email);
}

export async function sendCouponEmail(couponId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) return { success: false, error: 'Please sign in as an admin to send coupon emails.' };
    const response = await fetch(getApiUrl('/api/coupons/send-email'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ couponId }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) return { success: false, error: payload?.error || 'Could not send coupon email. Please try again.' };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not send coupon email. Please try again.' };
  }
}
