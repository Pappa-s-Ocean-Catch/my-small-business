import type { Order } from '@my-small-business/types';
import { getPaymentStatType } from '../utils/orderUtils';
import { buildChannelFinancialBreakdown, isMarketplaceSalesOrder } from './marketplace-pos-import';

export function buildCompletedOrderStats(orders: Order[]) {
  const salesOrders = orders.filter(isMarketplaceSalesOrder);
  // Use Report's channel totals so payout fallbacks and currency rounding agree.
  const netSales = buildChannelFinancialBreakdown(salesOrders)
    .reduce((sum, channel) => sum + (channel.netSales ?? 0), 0);
  let totalCard = 0;
  let totalCash = 0;
  let totalMarketplace = 0;
  for (const order of salesOrders) {
    const paymentType = getPaymentStatType(order);
    if (paymentType === 'card') totalCard += order.total;
    else if (paymentType === 'marketplace') totalMarketplace += order.total;
    else totalCash += order.total;
  }
  return {
    totalOrders: salesOrders.length,
    totalNetSales: Math.round(netSales * 100) / 100,
    totalCard,
    totalCash,
    totalMarketplace,
  };
}
