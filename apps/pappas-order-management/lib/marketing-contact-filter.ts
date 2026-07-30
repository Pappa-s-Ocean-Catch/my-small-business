export type ContactFilters = {
  email: boolean;
  phone: boolean;
};

export function matchesContactFilter(
  customer: { email?: string | null; phone?: string | null },
  filters: ContactFilters
) {
  if (filters.email && !customer.email?.trim()) return false;
  if (filters.phone && !customer.phone?.trim()) return false;
  return true;
}
