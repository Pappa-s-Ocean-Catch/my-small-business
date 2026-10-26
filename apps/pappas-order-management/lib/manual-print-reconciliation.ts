/** Only a confirmed failure permits an explicit retry of a submitted request. */
export function canRetryManualPrintRequest(
  requestIds: readonly string[],
  jobs: ReadonlyArray<{ id: string; status: string }>,
): boolean {
  return requestIds.every((id) => jobs.some((job) => job.id === id && job.status === 'failed'));
}
