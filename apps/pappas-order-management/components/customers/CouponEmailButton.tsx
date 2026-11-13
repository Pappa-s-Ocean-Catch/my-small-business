import React, { useRef, useState } from 'react';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import { appDialog } from '@/lib/app-dialog';
import { canEmailCoupon, sendCouponEmail } from '@/lib/coupon-email';
import type { Coupon } from '@/lib/coupons';

type Props = { coupon: Coupon; isAdmin: boolean; disabled?: boolean };

export function CouponEmailButton({ coupon, isAdmin, disabled }: Props) {
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  if (!isAdmin || !canEmailCoupon(coupon)) return null;
  const send = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setSending(true);
    try {
      const result = await sendCouponEmail(coupon.id);
      appDialog.alert(result.success ? 'Coupon email sent' : 'Email not sent', result.success ? `Coupon ${coupon.code} was emailed to its customer.` : result.error || 'Please try again.');
    } finally { inFlight.current = false; setSending(false); }
  };
  return <Button icon="email-send-outline" mode="outlined" loading={sending} disabled={sending || disabled} onPress={() => void send()}>Resend coupon email</Button>;
}
