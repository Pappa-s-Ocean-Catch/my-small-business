const STRIPE_PERCENT_FEE = Number(process.env.STRIPE_PERCENT_FEE ?? '0.0175');
const STRIPE_FIXED_FEE = Number(process.env.STRIPE_FIXED_FEE ?? '0.3');
const DELIVERY_PROCESSING_FEE = Number(process.env.DELIVERY_PROCESSING_FEE ?? '1');

export function calculateServiceFee({
  subtotal,
  tax,
  deliveryFee,
  rewardPointsDiscount = 0,
  orderType,
}: {
  subtotal: number;
  tax: number;
  deliveryFee: number;
  rewardPointsDiscount?: number;
  orderType?: 'pickup' | 'delivery' | null;
}) {
  const orderBaseAmount = Math.max(0, subtotal + tax - rewardPointsDiscount);
  const totalForFeeCalculation = Math.max(0, orderBaseAmount + deliveryFee);

  let serviceFee = totalForFeeCalculation * STRIPE_PERCENT_FEE + STRIPE_FIXED_FEE;
  if (orderType === 'delivery') {
    serviceFee += DELIVERY_PROCESSING_FEE;
  }

  serviceFee = Number(serviceFee.toFixed(2));
  const totalAmount = Number((orderBaseAmount + deliveryFee + serviceFee).toFixed(2));

  return {
    orderBaseAmount: Number(orderBaseAmount.toFixed(2)),
    serviceFee,
    totalAmount,
  };
}
