# Kitchen Text Receipt Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Print full kitchen/order receipts as fast ESC/POS text when selected, keep the existing image renderer as a fallback, and keep customer receipts image-only.

**Architecture:** Add a pure kitchen receipt document builder that reuses the data helpers used by `ReceiptTemplate`. Extend the existing print queue with a document-or-image payload union, then branch each kitchen print session before image capture. Simulator and customer-copy paths stay image based.

**Tech Stack:** Expo/React Native, TypeScript, Zustand, `react-native-esc-pos-printer`, native Raw TCP, Node test runner.

## Global Constraints

- `printerReceiptMode` accepts only `text` and `image`; missing or invalid saved settings normalize to `text`.
- The mode applies to manual, automatic, and section-routed kitchen/order receipt sessions.
- Customer receipts always use image capture and `escposPrintOrderImage`.
- Physical text jobs must skip template mount, render-settle delay, receipt-ref waits, and image capture.
- Simulator sessions remain captured image previews.
- Image mode must preserve the current capture and print behaviour.

---

## File Structure

- Create `lib/kitchen-receipt-document.ts`: `Order` to `EscPosDocument` conversion.
- Modify `lib/settings.ts`: print-mode type, default, loading, and saving.
- Modify `app/(drawer)/(tabs)/settings.tsx`: Text/Image setting control.
- Modify `stores/printerAutomationStore.ts` and `lib/print-queue.ts`: document payloads and dispatch.
- Modify `app/(drawer)/(tabs)/live-orders.tsx`, `app/(drawer)/pre-orders.tsx`, and `components/OrderDetailModal.tsx`: mode-specific kitchen preparation only.
- Create `test/kitchen-receipt-document.test.ts`; modify `test/image-only-printing.test.ts`; create or extend `test/settings.test.ts`.

### Task 1: Add a normalized kitchen receipt-mode setting

**Files:**
- Modify: `apps/pappas-order-management/lib/settings.ts`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`
- Test: `apps/pappas-order-management/test/settings.test.ts`

**Interfaces:**
- Produces `type PrinterReceiptMode = 'text' | 'image'`.
- Produces `normalizePrinterReceiptMode(value: unknown): PrinterReceiptMode`.
- Adds `AppSettings.printerReceiptMode`.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_APP_SETTINGS, normalizePrinterReceiptMode } from '../lib/settings';

test('defaults kitchen receipt printing to text', () => {
  assert.equal(DEFAULT_APP_SETTINGS.printerReceiptMode, 'text');
  assert.equal(normalizePrinterReceiptMode(undefined), 'text');
  assert.equal(normalizePrinterReceiptMode('other'), 'text');
  assert.equal(normalizePrinterReceiptMode('image'), 'image');
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="defaults kitchen receipt printing"`

Expected: compilation fails because the setting and normalizer are absent.

- [ ] **Step 3: Write the minimal implementation**

```ts
export type PrinterReceiptMode = 'text' | 'image';
export function normalizePrinterReceiptMode(value: unknown): PrinterReceiptMode {
  return value === 'image' ? 'image' : 'text';
}

// Add to AppSettings and DEFAULT_APP_SETTINGS:
printerReceiptMode: 'text',
// Use normalizePrinterReceiptMode(parsed?.printerReceiptMode) in load and
// normalizePrinterReceiptMode(settings.printerReceiptMode) in save.
```

In the settings component, add/hydrate/persist `printerReceiptMode`. Under Print behavior add contained/outlined `Text` and `Image` buttons labelled `Kitchen receipt mode`, plus the helper text `Text printing is faster; Image preserves the current captured receipt layout.`

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="defaults kitchen receipt printing"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/lib/settings.ts 'apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx' apps/pappas-order-management/test/settings.test.ts
git commit -m "feat: add kitchen receipt print mode setting"
```

### Task 2: Build the text receipt document

**Files:**
- Create: `apps/pappas-order-management/lib/kitchen-receipt-document.ts`
- Test: `apps/pappas-order-management/test/kitchen-receipt-document.test.ts`

**Interfaces:**
- Produces `buildKitchenReceiptDocument(order: Order, options: KitchenReceiptDocumentOptions): EscPosDocument`.
- Options: `paperWidth`, `showTicketCounter`, `onlyTicketIndex`, `duplicateBySections`, `printDebugContext`.

- [ ] **Step 1: Write the failing test**

```ts
test('builds a complete text kitchen receipt', () => {
  const document = buildKitchenReceiptDocument(makeOrder({
    order_number: 'ORD-123', customer_name: 'Ada Lovelace', payment_method: 'online',
    payment_status: 'paid', scheduled_pickup_at: '2026-08-15T18:30:00.000Z',
    items: [{ product_name: 'Fish Burger', quantity: 2, comment: 'No salt',
      removed_ingredients: ['Onion'], addons: [{ addon_item_name: 'Cheese', quantity: 2, price: 1 }] }],
  }), { paperWidth: '80mm', showTicketCounter: false, duplicateBySections: false, printDebugContext: null });
  const text = document.nodes.filter((node) => node.type === 'text').map((node) => node.text).join('\n');
  assert.match(text, /\*\*\* PRE-ORDER \*\*\*/);
  assert.match(text, /Ada Lovelace|2x Fish Burger|No Onion|2x Cheese \(\$1\.00\)|Notes: No salt|TOTAL:|P123/);
  assert.deepEqual(document.nodes.at(-1), { type: 'cut', partial: false });
});
```

Add tests for a routed section/counter and all delivery fields (address, status, driver, instructions).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="complete text kitchen receipt"`

Expected: compilation fails because the builder module is absent.

- [ ] **Step 3: Write the minimal implementation**

```ts
export function buildKitchenReceiptDocument(order: Order, options: KitchenReceiptDocumentOptions): EscPosDocument {
  // Reuse ReceiptTemplate helpers: getReceiptHeader, buildKitchenReceiptCopies,
  // getOrderDisplaySubtotal/Total, getOrderOptions/Notes, groupAddons,
  // getOrderPromotionSummary, and getKitchenPrintDebugFooterLines.
}
```

Render all receipt data from `ReceiptTemplate`: header/marketplace label, preorder/date/payment, customer/delivery, notes/options, section headings, items and modifications, totals/status, order number, footer, and diagnostics. Use 32 columns at 58mm and 48 at 80mm; wrap long labels and format money rows to fit. Represent visual hierarchy with alignment, bold, invert, scaling, and dashed rules. End every ticket with feed 3 then full cut.

- [ ] **Step 4: Run document tests to verify they pass**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="text kitchen receipt"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/lib/kitchen-receipt-document.ts apps/pappas-order-management/test/kitchen-receipt-document.test.ts
git commit -m "feat: build kitchen receipt ESC POS document"
```

### Task 3: Carry and dispatch text documents through the queue

**Files:**
- Modify: `apps/pappas-order-management/stores/printerAutomationStore.ts`
- Modify: `apps/pappas-order-management/lib/print-queue.ts`
- Modify: `apps/pappas-order-management/test/image-only-printing.test.ts`

**Interfaces:**
- `PreparedPrintJobInput` is a discriminated payload union with exactly one of `image` or `document`.
- `PrintJob` gains `document: EscPosDocument | null`.
- Images dispatch to `escposPrintOrderImage`; documents dispatch to `escposPrintDocument`.

- [ ] **Step 1: Write the failing test**

```ts
test('print queue supports image and text-document kitchen payloads', () => {
  const queue = source('lib/print-queue.ts');
  assert.match(queue, /document: EscPosDocument/);
  assert.match(queue, /escposPrintDocument\(startedJob\.document/);
  assert.match(queue, /escposPrintOrderImage\(startedJob\.image/);
});

test('customer receipt preparation remains image based', () => {
  const modal = source('components/OrderDetailModal.tsx');
  const customer = modal.slice(modal.indexOf('const handleCustomerCopyPrint'));
  assert.match(customer, /captureReceiptForPrinter\(customerReceiptRef\.current/);
  assert.match(customer, /onPrintCustomerCopyImage\(printOrder, image, printer\)/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="queue supports image|customer receipt preparation remains"`

Expected: FAIL because document payloads are absent.

- [ ] **Step 3: Write the minimal implementation**

```ts
export type PreparedPrintJobInput = BaseJob & (
  { image: PrinterImageSource; document?: never } |
  { document: EscPosDocument; image?: never }
);

if (startedJob.document) await escposPrintDocument(startedJob.document, startedJob.printer);
else if (startedJob.image) await escposPrintOrderImage(startedJob.image, startedJob.printer, startedJob.copies, startedJob.width);
else throw new Error('Print job payload is unavailable.');
```

Clear `document` along with `image` after completed/failed jobs. Preserve image metrics and journal `payload=image`; document entries log `payload=text` and no image-only metrics.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="queue supports image|customer receipt preparation remains"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/stores/printerAutomationStore.ts apps/pappas-order-management/lib/print-queue.ts apps/pappas-order-management/test/image-only-printing.test.ts
git commit -m "feat: queue text receipt documents"
```

### Task 4: Branch all physical kitchen sessions before capture

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/live-orders.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/pre-orders.tsx`
- Modify: `apps/pappas-order-management/components/OrderDetailModal.tsx`
- Modify: `apps/pappas-order-management/test/image-only-printing.test.ts`

**Interfaces:**
- Consumes `printerReceiptMode` and `buildKitchenReceiptDocument`.
- Creates document jobs for text-mode physical kitchen printers; preserves image jobs for image mode, simulators, and customer receipts.

- [ ] **Step 1: Write the failing test**

```ts
test('manual and automatic kitchen entry points select text mode before capture', () => {
  for (const path of ['app/(drawer)/(tabs)/live-orders.tsx', 'app/(drawer)/pre-orders.tsx']) {
    const text = source(path);
    assert.match(text, /printerReceiptMode === 'text'/);
    assert.match(text, /buildKitchenReceiptDocument/);
  }
});

test('manual order-detail kitchen reprint reads mode while customer copy does not', () => {
  const modal = source('components/OrderDetailModal.tsx');
  assert.match(modal.slice(modal.indexOf('const handlePrint')), /printerReceiptMode === 'text'/);
  assert.doesNotMatch(modal.slice(modal.indexOf('const handleCustomerCopyPrint')), /printerReceiptMode === 'text'/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="kitchen entry points|manual order-detail kitchen"`

Expected: FAIL because all kitchen paths capture images.

- [ ] **Step 3: Write the minimal implementation**

```ts
if (settings.printerReceiptMode === 'text' && !isSimulatorPrinter(printer)) {
  jobs.push({ document: buildKitchenReceiptDocument(order, ticketOptions), printer, width: targetDots, label: printer.deviceName });
  continue;
}
// Existing template state, render waits, ref waits, and image capture stay here.
```

Apply the branch to direct and routed manual/auto paths in Live Orders and Pre-orders, preserving their existing claims and debug context. In `OrderDetailModal`, send the kitchen document directly for physical text-mode reprints before setting `captureTarget`; do not change `handleCustomerCopyPrint`. Keep image capture for simulator sessions and label journal entries `payload=text` or `payload=image`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="kitchen entry points|manual order-detail kitchen|customer receipt preparation remains"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'apps/pappas-order-management/app/(drawer)/(tabs)/live-orders.tsx' 'apps/pappas-order-management/app/(drawer)/pre-orders.tsx' apps/pappas-order-management/components/OrderDetailModal.tsx apps/pappas-order-management/test/image-only-printing.test.ts
git commit -m "feat: print kitchen receipts as text"
```

### Task 5: Verify the full implementation

**Files:**
- Modify only files from Tasks 1-4 if verification exposes a defect.

- [ ] **Step 1: Run all unit tests**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: exit code 0.

- [ ] **Step 2: Run TypeScript validation**

Run: `pnpm --filter pappas-order-management exec tsc --noEmit -p tsconfig.json`

Expected: exit code 0.

- [ ] **Step 3: Inspect final change scope**

Run: `git diff --check && git status --short && git log --oneline -5`

Expected: no whitespace errors; existing user changes are neither discarded nor staged by this feature.

- [ ] **Step 4: Commit only a verification correction if needed**

```bash
git add <corrected-files>
git commit -m "fix: verify kitchen text receipt printing"
```
