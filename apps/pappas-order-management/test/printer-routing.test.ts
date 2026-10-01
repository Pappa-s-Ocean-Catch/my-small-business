import assert from 'node:assert/strict';
import test from 'node:test';

import {
  groupSectionPrintJobsForImageCapture,
} from '../lib/section-print-image-capture';
import { buildSectionPrintJobs, type ResolvedSectionPrintJob } from '../lib/printer-routing';
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

test('routes combine product with grilled add-on to both grilled and fried printers', () => {
  const settings = {
    printerSaved: [
      { id: 'p-fryer', target: 'tcp://192.168.1.101', deviceName: 'Fryer Printer' },
      { id: 'p-grill', target: 'tcp://192.168.1.102', deviceName: 'Grill Printer' },
    ],
    printerSectionAssignments: [
      {
        id: 'assign-fryer',
        sectionName: 'Fried',
        printerTarget: 'tcp://192.168.1.101',
        printMode: 'combine' as const,
        template: 'kitchen' as const,
        isDefault: true,
      },
      {
        id: 'assign-grill',
        sectionName: 'Grilled',
        printerTarget: 'tcp://192.168.1.102',
        printMode: 'combine' as const,
        template: 'kitchen' as const,
        isDefault: false,
      },
    ],
    printerSelectedTarget: 'tcp://192.168.1.101',
  };

  const order = {
    items: [
      {
        id: 'item-1',
        order_id: 'order-1',
        product_id: 'flake-pack-1-id',
        product_name: 'Flake Pack For One',
        product_description: '1 Flake, 1 Potato Cake, 1 Dim Sim, & Small Chips',
        product_image_url: null,
        base_price: 18,
        override_price: null,
        quantity: 1,
        subtotal: 18,
        section: 'Grilled, Fried',
        removed_ingredients: [],
        comment: null,
        created_at: '2026-09-30T00:00:00.000Z',
        addons: [
          {
            id: 'addon-1',
            order_item_id: 'item-1',
            addon_group_id: 'group-fish',
            addon_group_name: 'Fish Cooking Option',
            addon_item_id: 'item-grilled',
            addon_item_name: 'Grilled',
            addon_item_price: 0,
            section: 'Grilled',
            created_at: '2026-09-30T00:00:00.000Z',
          },
        ],
      },
    ],
  };

  const jobs = buildSectionPrintJobs(settings, order);
  assert.equal(jobs.length, 2);
  assert.deepEqual(
    jobs.map((j) => ({
      sectionName: j.sectionName,
      printerTarget: j.printer?.target,
      label: j.label,
    })),
    [
      { sectionName: 'GRILLED', printerTarget: 'tcp://192.168.1.102', label: 'GRILLED -> Grill Printer' },
      { sectionName: 'FRIED', printerTarget: 'tcp://192.168.1.101', label: 'FRIED -> Fryer Printer' },
    ]
  );
});

