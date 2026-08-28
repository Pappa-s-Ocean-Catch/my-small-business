export type SectionPrintImageCaptureJob = {
  key: string;
  printMode: 'combine' | 'separate';
  template: 'kitchen' | 'customer-copy';
};

export function getSectionPrintImageCaptureKey(
  job: SectionPrintImageCaptureJob,
  driver: string,
): string {
  return job.printMode === 'separate' ? job.key : `${job.template}:${driver}`;
}

export function groupSectionPrintJobsForImageCapture<T extends SectionPrintImageCaptureJob>(
  jobs: T[],
  getDriver: (job: T) => string,
): T[][] {
  const groups: T[][] = [];
  const combinedGroups = new Map<string, T[]>();

  for (const job of jobs) {
    if (job.printMode === 'separate') {
      groups.push([job]);
      continue;
    }

    const captureKey = getSectionPrintImageCaptureKey(job, getDriver(job));
    const existing = combinedGroups.get(captureKey);
    if (existing) {
      existing.push(job);
      continue;
    }

    const group = [job];
    combinedGroups.set(captureKey, group);
    groups.push(group);
  }

  return groups;
}
