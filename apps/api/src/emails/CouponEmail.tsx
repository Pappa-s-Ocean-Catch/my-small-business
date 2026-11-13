import * as React from 'react';
import { Button, Section, Text } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import type { Coupon } from '../lib/coupons';

type Props = {
  coupon: Coupon;
  customerName: string;
  businessName: string;
  logoUrl?: string;
  orderUrl: string;
};

export function CouponEmail({ coupon, customerName, businessName, logoUrl, orderUrl }: Props) {
  const discount = coupon.discount_type === 'percent'
    ? `${Number(coupon.discount_value)}% off`
    : `$${Number(coupon.discount_value).toFixed(2)} off`;
  const expires = coupon.ends_at ? new Date(coupon.ends_at).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : null;
  return <EmailLayout title="A little thank-you, just for you" companyName={businessName} logoUrl={logoUrl} previewText={`Enjoy ${discount} your next order with code ${coupon.code}.`} footerText={`© ${businessName}. All rights reserved.`}>
    <Text style={{ fontSize: 16, lineHeight: '26px', color: '#334155' }}>Hi {customerName},</Text>
    <Text style={{ fontSize: 16, lineHeight: '26px', color: '#334155' }}>Here's a little something from {businessName} for your next meal.</Text>
    <Section style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '24px', textAlign: 'center', margin: '24px 0' }}>
      <Text style={{ fontSize: 36, fontWeight: 700, color: '#1d4ed8', margin: '0 0 12px' }}>{discount}</Text>
      <Text style={{ fontSize: 16, color: '#334155', margin: '0 0 16px' }}>{coupon.title}</Text>
      <Text style={{ fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: '2px', margin: '0 0 8px' }}>YOUR COUPON CODE</Text>
      <Text style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: '#0f172a', overflowWrap: 'anywhere', margin: 0 }}>{coupon.code}</Text>
    </Section>
    <Text style={{ fontSize: 16, lineHeight: '26px', color: '#334155' }}>Enter this code at checkout when ordering online, or mention it when ordering in store. This coupon is reserved for you.</Text>
    <Section style={{ textAlign: 'center', margin: '24px 0' }}><Button href={orderUrl} style={{ backgroundColor: '#2563eb', color: '#ffffff', fontSize: 16, fontWeight: 600, borderRadius: 8, padding: '14px 28px' }}>Order your favourites</Button></Section>
    <Text style={{ fontSize: 13, lineHeight: '22px', color: '#64748b' }}>
      Applies to the order subtotal; the discount cannot exceed the subtotal.<br />
      {Number(coupon.min_cart_subtotal) > 0 ? `Minimum subtotal: $${Number(coupon.min_cart_subtotal).toFixed(2)}.` : 'No minimum spend.'}<br />
      {coupon.max_uses != null ? `${Math.max(0, Number(coupon.max_uses) - Number(coupon.usage_count))} use(s) remaining.` : 'No total usage limit.'}
      {coupon.max_uses_per_user != null ? ` Up to ${coupon.max_uses_per_user} use(s) per customer.` : ''}<br />
      {expires ? `Valid until ${expires}.` : 'No expiry date.'}
    </Text>
    <Text style={{ fontSize: 16, lineHeight: '26px', color: '#334155' }}>We look forward to seeing you,<br /><strong>{businessName}</strong></Text>
  </EmailLayout>;
}
