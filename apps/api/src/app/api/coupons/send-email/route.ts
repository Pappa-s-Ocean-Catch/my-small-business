import * as React from 'react';
import { Resend } from 'resend';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { handleCouponEmail } from '@/lib/coupon-email';
import { getBrandSettings } from '@/lib/brand-settings';
import { CouponEmail } from '@/emails/CouponEmail';

export async function POST(request: Request) {
  return handleCouponEmail(request, {
    createClient: createServiceRoleClient,
    sendEmail: async ({ email, customerName, coupon }) => {
      if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { success: false, error: 'Email service is not configured.' };
      const brand = await getBrandSettings();
      const businessName = brand?.business_name || process.env.NEXT_PUBLIC_STORE_NAME || "Pappa's Ocean Catch";
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pappasfishnchips.com.au';
      const orderUrl = new URL('/order', siteUrl);
      orderUrl.searchParams.set('coupon', coupon.code);
      const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: process.env.EMAIL_FROM,
        to: [process.env.OVERRIDE_EMAIL_ADDRESS || email],
        subject: `A ${coupon.discount_type === 'percent' ? `${Number(coupon.discount_value)}%` : `$${Number(coupon.discount_value).toFixed(2)}`} thank-you from ${businessName}`,
        react: React.createElement(CouponEmail, { coupon, customerName, businessName, logoUrl: brand?.logo_url || new URL('/favicon.ico', siteUrl).toString(), orderUrl: orderUrl.toString() }),
      });
      return error ? { success: false, error: 'Email delivery failed. Please try again.' } : { success: true };
    },
  });
}
