import type { Order } from '@my-small-business/types';
import {
  buildChannelFinancialBreakdown,
  getOrderGrossSales,
  isMarketplaceSalesOrder,
} from './marketplace-pos-import';
import { formatDateToLocalISO, getOrderChannelLabel, getPaymentStatLabel } from '../utils/orderUtils';

export const REPORT_RECEIPT_WIDTH = 576;

export type ReportPrintType = 'daily' | 'weekly' | 'monthly' | 'rolling';

export type ReportBreakdownRow = {
  label: string;
  orders: number;
  total: number;
};

export type ReportPrintSnapshot = {
  reportType: ReportPrintType;
  reportLabel: string;
  periodLabel: string;
  generatedAt: string;
  summary: {
    grossSales: number;
    paidOrders: number;
    averageOrder: number;
    discounts: number;
  };
  salesByDate: Array<{ label: string; total: number }> | null;
  paymentBreakdown: ReportBreakdownRow[];
  channelBreakdown: ReportBreakdownRow[];
  channelFinancials: ReturnType<typeof buildChannelFinancialBreakdown>;
};

const REPORT_LABELS: Record<ReportPrintType, string> = {
  daily: 'Sales report',
  weekly: 'Weekly sales',
  monthly: 'Monthly sales',
  rolling: 'Last X days',
};

function buildBreakdown(orders: Order[], groupBy: (order: Order) => string): ReportBreakdownRow[] {
  const rows = new Map<string, ReportBreakdownRow>();
  for (const order of orders) {
    const label = groupBy(order);
    const current = rows.get(label) || { label, orders: 0, total: 0 };
    current.orders += 1;
    current.total += Number(getOrderGrossSales(order)) || 0;
    rows.set(label, current);
  }
  return Array.from(rows.values()).sort((a, b) => b.total - a.total);
}

function formatDateLabel(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).replace(',', '');
}

function buildSalesByDate(orders: Order[]): Array<{ label: string; total: number }> {
  const totals = new Map<string, number>();
  for (const order of orders) {
    const dateKey = formatDateToLocalISO(new Date(order.created_at));
    totals.set(dateKey, (totals.get(dateKey) || 0) + (Number(getOrderGrossSales(order)) || 0));
  }
  return Array.from(totals.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, total]) => ({ label: formatDateLabel(dateKey), total }));
}

export function buildReportPrintSnapshot({
  reportType,
  periodLabel,
  generatedAt,
  orders,
}: {
  reportType: ReportPrintType;
  periodLabel: string;
  generatedAt: Date;
  orders: Order[];
}): ReportPrintSnapshot {
  const salesOrders = orders.filter(isMarketplaceSalesOrder);
  const grossSales = salesOrders.reduce((total, order) => total + (Number(getOrderGrossSales(order)) || 0), 0);
  const discounts = salesOrders.reduce(
    (total, order) => total + (Number(order.promotion_discount) || 0) + (Number(order.coupon_discount) || 0),
    0
  );

  return {
    reportType,
    reportLabel: REPORT_LABELS[reportType],
    periodLabel,
    generatedAt: generatedAt.toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    summary: {
      grossSales,
      paidOrders: salesOrders.length,
      averageOrder: salesOrders.length ? grossSales / salesOrders.length : 0,
      discounts,
    },
    salesByDate: reportType === 'daily' ? null : buildSalesByDate(salesOrders),
    paymentBreakdown: buildBreakdown(salesOrders, getPaymentStatLabel),
    channelBreakdown: buildBreakdown(salesOrders, getOrderChannelLabel),
    channelFinancials: buildChannelFinancialBreakdown(orders),
  };
}
