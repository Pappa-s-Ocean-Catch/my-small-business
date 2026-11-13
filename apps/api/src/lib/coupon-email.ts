import type { SupabaseClient } from '@supabase/supabase-js';
import type { Coupon } from './coupons';

export type CouponEmailDelivery = { email: string; customerName: string; coupon: Coupon };
type Dependencies = {
  createClient: () => Promise<SupabaseClient>;
  sendEmail: (payload: CouponEmailDelivery) => Promise<{ success: boolean; error?: string }>;
};

/** One endpoint sends the saved code for initial delivery and subsequent resends. */
export async function handleCouponEmail(request: Request, dependencies: Dependencies): Promise<Response> {
  const fail = (error: string, status: number) => Response.json({ success: false, error }, { status });
  try {
    const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return fail('Please sign in as an admin.', 401);
    const supabase = await dependencies.createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return fail('Invalid authenticated session.', 401);
    const { data: actor, error: roleError } = await supabase.from('profiles').select('role_slug').eq('id', user.id).single();
    if (roleError) return fail('Could not verify admin permissions.', 500);
    if (actor?.role_slug !== 'admin') return fail('Only admins can send coupon emails.', 403);

    const body = await request.json().catch(() => null);
    const couponId = typeof body?.couponId === 'string' ? body.couponId.trim() : '';
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(couponId)) return fail('A valid couponId is required.', 400);
    const { data: coupon, error: couponError } = await supabase.from('coupons').select('*').eq('id', couponId).single();
    if (couponError && couponError.code !== 'PGRST116') return fail('Could not load coupon.', 500);
    if (!coupon) return fail('Coupon not found.', 404);
    const now = Date.now();
    if (!coupon.is_active
      || (coupon.starts_at && (!Number.isFinite(Date.parse(coupon.starts_at)) || Date.parse(coupon.starts_at) > now))
      || (coupon.ends_at && (!Number.isFinite(Date.parse(coupon.ends_at)) || Date.parse(coupon.ends_at) <= now))
      || (coupon.max_uses != null && Number(coupon.usage_count) >= Number(coupon.max_uses))
      || (coupon.max_uses_per_user != null && Number(coupon.max_uses_per_user) <= 0)
      || !['percent', 'fixed'].includes(coupon.discount_type)
      || !Number.isFinite(Number(coupon.discount_value)) || Number(coupon.discount_value) <= 0
      || (coupon.discount_type === 'percent' && Number(coupon.discount_value) > 100)) {
      return fail('Only active, started, unexpired coupons with uses remaining can be emailed.', 409);
    }

    let email = coupon.target_email?.trim() || '';
    let customerName = 'there';
    let recipientId: string | null = coupon.user_id;
    if (coupon.user_id) {
      const { data: target, error: targetError } = await supabase.from('profiles').select('full_name, email').eq('id', coupon.user_id).single();
      if (targetError && targetError.code !== 'PGRST116') return fail('Could not load the coupon customer.', 500);
      if (!target) return fail('The coupon customer could not be found.', 422);
      email = target.email?.trim() || '';
      customerName = target.full_name?.trim() || 'there';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('This coupon has no valid customer email address.', 422);
    if (!recipientId && coupon.max_uses_per_user != null) {
      // Escape pattern characters so an address containing '_' or '%' is literal.
      const emailPattern = email.replace(/[\\%_]/g, (char: string) => `\\${char}`);
      const { data: target, error } = await supabase.from('profiles').select('id').ilike('email', emailPattern).limit(1).maybeSingle();
      if (error) return fail('Could not verify the coupon recipient.', 500);
      recipientId = target?.id || null;
    }
    if (coupon.max_uses_per_user != null) {
      let usageQuery = supabase.from('coupon_redemptions')
        .select(recipientId ? 'id' : 'id, orders!inner(customer_email)', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id);
      usageQuery = recipientId ? usageQuery.eq('user_id', recipientId)
        : usageQuery.ilike('orders.customer_email', email.replace(/[\\%_]/g, (char: string) => `\\${char}`));
      const { count, error } = await usageQuery;
      if (error || count == null) return fail('Could not verify coupon usage.', 500);
      if (count >= Number(coupon.max_uses_per_user)) return fail('This customer has already used this coupon.', 409);
    }
    const result = await dependencies.sendEmail({ email, customerName, coupon: coupon as Coupon });
    if (!result.success) return fail(result.error || 'Could not send coupon email. Please try again.', 502);
    return Response.json({ success: true });
  } catch (error) {
    console.error('[coupon-email] Send failed:', error);
    return fail('Could not send coupon email. Please try again.', 500);
  }
}
