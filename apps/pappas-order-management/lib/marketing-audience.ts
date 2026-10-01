import { compareMarketingPriority, type MarketingPriorityCustomer } from './marketing-priority';

export type MarketingHistoryFilter = 'all' | 'never-contacted' | 'never-email' | 'never-sms';
export function matchesMarketingHistory(customer: MarketingPriorityCustomer, filter: MarketingHistoryFilter): boolean {
  if (filter === 'never-email') return !customer.lastMarketingEmailSentAt;
  if (filter === 'never-sms') return !customer.lastMarketingSmsSentAt;
  if (filter === 'never-contacted') return !customer.lastMarketingEmailSentAt && !customer.lastMarketingSmsSentAt;
  return true;
}
export function compareNeverContacted(a: MarketingPriorityCustomer, b: MarketingPriorityCustomer): number {
  return Number(matchesMarketingHistory(b, 'never-contacted')) - Number(matchesMarketingHistory(a, 'never-contacted')) || compareMarketingPriority(a, b);
}
export type AudienceRecipient = { profileId?: string; optInMarketing?: boolean; email?: string | null; phone?: string | null };

export function canSelectRecipient(customer: AudienceRecipient): boolean {
  return Boolean(customer.profileId && customer.optInMarketing !== false && (customer.email?.trim() || customer.phone?.trim()));
}
export function removeRecipients<T>(selection: Map<string, T>, ids: Set<string>): Map<string, T> {
  return new Map([...selection].filter(([id]) => !ids.has(id)));
}

export async function loadMarketingAudience<T>(
  fetchBatch: (offset: number, limit: number) => Promise<{ data: T[] | null; error: string | null }>,
): Promise<{ data: T[] | null; error: string | null }> {
  const customers: T[] = [];
  const batchSize = 500;
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await fetchBatch(offset, batchSize);
    if (error) return { data: null, error };
    customers.push(...(data || []));
    if (!data || data.length < batchSize) return { data: customers, error: null };
  }
}

export function getPendingRecipients<T extends AudienceRecipient>(customers: T[], channel: 'email' | 'sms', sentIds: Set<string>): T[] {
  return customers.filter((customer) => canSelectRecipient(customer) && !sentIds.has(customer.profileId!) && Boolean(channel === 'email' ? customer.email?.trim() : customer.phone?.trim()));
}
