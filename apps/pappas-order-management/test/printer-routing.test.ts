import assert from 'node:assert/strict';
import test from 'node:test';

import {
  groupSectionPrintJobsForImageCapture,
} from '../lib/section-print-image-capture';
import type { ResolvedSectionPrintJob } from '../lib/printer-routing';
import { shouldSkipOverlappingCombinedSectionTicket } from '../utils/orderUtils';

test('skips a combined section ticket when one of its individual sections already has a ticket', () => {
  assert.equal(
    shouldSkipOverlappingCombinedSectionTicket('GRILLED & FRIED', ['GRILLED', 'FRIED', 'GRILLED & FRIED']),
    true,
  );
});

test('keeps a combined section ticket when neither individual section has a ticket', () => {
  assert.equal(
    shouldSkipOverlappingCombinedSectionTicket('GRILLED & FRIED', ['GRILLED & FRIED']),
    false,
  );
});

const routedJob = (overrides: Partial<ResolvedSectionPrintJob>): ResolvedSectionPrintJob => ({
  key: 'job',
  assignmentId: 'assignment',
  sectionName: 'Fried',
  printer: null,
  printMode: 'combine',
  template: 'kitchen',
  duplicateBySections: false,
  label: 'Fried -> Printer',
  ...overrides,
});

test('shares one image capture across combined jobs but retains each separate section capture', () => {
  const captureGroups = groupSectionPrintJobsForImageCapture([
    routedJob({ key: 'fried', label: 'Fried -> Fryer' }),
    routedJob({ key: 'grilled', sectionName: 'Grilled', label: 'Grilled -> Grill' }),
    routedJob({
      key: 'customer-copy',
      sectionName: 'Customer Copy',
      template: 'customer-copy',
      label: 'Customer Copy -> Till',
    }),
    routedJob({
      key: 'till',
      sectionName: 'Till',
      printMode: 'separate',
      duplicateBySections: true,
      onlyTicketIndex: 2,
      label: 'Till -> Till Printer',
    }),
  ], () => 'epsonSdk');

  assert.deepEqual(captureGroups.map((group) => group.map((job) => job.key)), [
    ['fried', 'grilled'],
    ['customer-copy'],
    ['till'],
  ]);
});
