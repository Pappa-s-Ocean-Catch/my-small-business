export type CustomerSummaryRow = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  profileId?: string | null;
};

export function customerFromSummary(row: CustomerSummaryRow) {
  if (!row.profileId) return null;
  return {
    id: row.profileId,
    name: row.name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
  };
}
