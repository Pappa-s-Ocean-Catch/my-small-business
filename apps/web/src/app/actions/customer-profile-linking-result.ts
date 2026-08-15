export function toCustomerProfileMergeResult(
  data: string | null,
  error: { message: string } | null,
): { success: true; mergedProfileId: string | null } | { success: false; error: string } {
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, mergedProfileId: data };
}
