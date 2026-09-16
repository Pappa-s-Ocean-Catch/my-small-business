'use server';

import { NextResponse } from 'next/server';
import { calculateServiceFee } from '@/lib/payment-fees';

interface CalculateFeesBody {
  subtotal: number;
  tax?: number;
  deliveryFee?: number;
  rewardPointsDiscount?: number;
  promotionDiscount?: number;
  couponDiscount?: number;
  orderType?: 'pickup' | 'delivery' | null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CalculateFeesBody;

    const subtotal = Number(body.subtotal ?? 0);
    const tax = Number(body.tax ?? 0);
    const deliveryFee = Number(body.deliveryFee ?? 0);
    const rewardPointsDiscount = Number(body.rewardPointsDiscount ?? 0);
    const promotionDiscount = Number(body.promotionDiscount ?? 0);
    const couponDiscount = Number(body.couponDiscount ?? 0);

    const result = calculateServiceFee({
      subtotal,
      tax,
      deliveryFee,
      rewardPointsDiscount,
      promotionDiscount,
      couponDiscount,
      orderType: body.orderType ?? null,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate fees',
      },
      { status: 500 }
    );
  }
}
