export type PrioritizedPrintJob = {
  id: string;
  priority: 'normal' | 'customer-receipt';
  status: 'queued' | 'printing' | 'success' | 'failed';
  printerTarget: string;
};

export function selectReadyPrintJobIds(jobs: PrioritizedPrintJob[]): string[] {
  const printingTargets = new Set(
    jobs.filter((job) => job.status === 'printing').map((job) => job.printerTarget),
  );
  const selectedTargets = new Set<string>();

  return jobs
    .filter((job) => job.status === 'queued')
    .sort((left, right) => (
      (left.priority === 'customer-receipt' ? 0 : 1) - (right.priority === 'customer-receipt' ? 0 : 1)
    ))
    .filter((job) => {
      if (printingTargets.has(job.printerTarget) || selectedTargets.has(job.printerTarget)) return false;
      selectedTargets.add(job.printerTarget);
      return true;
    })
    .map((job) => job.id);
}
