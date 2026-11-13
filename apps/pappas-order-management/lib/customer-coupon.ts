import { sendCouponEmail } from './coupon-email';
import { supabase } from './supabase';
import { createCustomerIfNotExists } from './customers';
import type { Coupon, PromotionDiscountType } from './coupons';

export type CouponCustomer = {
  profileId?: string | null;
  name?: string;
  email?: string | null;
  phone?: string | null;
};
export type CreateCustomerCouponInput = {
  customer: CouponCustomer | null;
  code: string;
  title: string;
  discountType: PromotionDiscountType;
  discountValue: string;
  sendEmail?: boolean;
};

/** Authenticated inserts are also protected by the coupons_admin_all database policy. */
export async function createCustomerCoupon(input: CreateCustomerCouponInput): Promise<{ data: Coupon | null; error: string | null; emailSent?: boolean; emailError?: string }> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { data: null, error: 'Please sign in as an admin to create coupons.' };
    const { data: actor, error: roleError } = await supabase.from('profiles').select('role_slug').eq('id', user.id).single();
    if (roleError || actor?.role_slug !== 'admin') return { data: null, error: 'Only admins can create coupons.' };

    const code = input.code.trim().toUpperCase();
    const title = input.title.trim();
    if (!/^[A-Z0-9_-]{1,64}$/.test(code)) return { data: null, error: 'Use 1–64 letters, numbers, hyphens or underscores for the code.' };
    if (!title) return { data: null, error: 'Enter a coupon title.' };
    const valueText = input.discountValue.trim();
    const value = Number(valueText);
    if (!['percent', 'fixed'].includes(input.discountType) || !/^\d+(\.\d{1,2})?$/.test(valueText) || !Number.isFinite(value) || value <= 0 || value > 99999999.99) {
      return { data: null, error: 'Enter a positive discount with at most two decimal places.' };
    }
    if (input.discountType === 'percent' && value > 100) return { data: null, error: 'Percentage must be greater than 0 and no more than 100.' };

    let userId = input.customer?.profileId?.trim() || null;
    const email = input.customer?.email?.trim().toLowerCase() || null;
    const phone = input.customer?.phone?.trim();
    if (!userId && !email && phone) {
      const result = await createCustomerIfNotExists(phone, input.customer?.name || '');
      if (result.error || !result.data) return { data: null, error: result.error || 'Could not link this customer to a profile.' };
      userId = result.data.id;
    }
    if (!userId && !email) return { data: null, error: 'Select a customer with a profile, email or phone number.' };

    const { data, error } = await supabase.from('coupons').insert({
      code, title, discount_type: input.discountType, discount_value: value,
      user_id: userId, target_email: userId ? null : email,
      is_active: true, max_uses: 1, max_uses_per_user: 1, min_cart_subtotal: 0,
    }).select('*').single();
    if (error) return { data: null, error: error.code === '23505' ? 'This coupon code already exists. Choose another code.' : error.message };
    if (!data) return { data: null, error: 'Could not create the coupon. Please try again.' };
    const coupon: Coupon = { ...data, discount_value: Number(data.discount_value), min_cart_subtotal: Number(data.min_cart_subtotal ?? 0), usage_count: Number(data.usage_count ?? 0) };
    if (input.sendEmail) {
      // Delivery failure must never turn a saved coupon into a failed creation.
      let delivery: { success: boolean; error?: string };
      try { delivery = await sendCouponEmail(coupon.id); }
      catch { delivery = { success: false, error: 'Could not send coupon email. Please use Resend coupon email.' }; }
      return { data: coupon, error: null, emailSent: delivery.success, emailError: delivery.error };
    }
    return { data: coupon, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Failed to create coupon.' };
  }
}
