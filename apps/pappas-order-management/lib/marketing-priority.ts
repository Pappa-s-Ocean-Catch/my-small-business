export type MarketingPriorityCustomer = {
  lastOrderDate?: string | null;
  lastMarketingSmsSentAt?: string | null;
  lastMarketingEmailSentAt?: string | null;
};

function getPriorityTime(value?: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function compareMarketingPriority(
  a: MarketingPriorityCustomer,
  b: MarketingPriorityCustomer
): number {
  return (
    getPriorityTime(a.lastOrderDate) - getPriorityTime(b.lastOrderDate) ||
    getPriorityTime(a.lastMarketingSmsSentAt) - getPriorityTime(b.lastMarketingSmsSentAt) ||
    getPriorityTime(a.lastMarketingEmailSentAt) - getPriorityTime(b.lastMarketingEmailSentAt)
  );
}

export function sortByMarketingPriority<T extends MarketingPriorityCustomer>(customers: T[]): T[] {
  return [...customers].sort(compareMarketingPriority);
}
