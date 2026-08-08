# Priority In-store Customer Receipt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Print one priority customer receipt for a newly saved, paid POS in-store cash, card, or SmartPay order when the local register setting permits it.

**Architecture:** Keep eligibility and time-window decisions in a pure receipt-auto-print module. Store register-local settings alongside current printer settings. Expose an imperative callback from `PrinterAutomationProvider` that renders the existing `CustomerReceiptTemplate`, captures it, and queues it ahead of ordinary work; POS invokes that callback only in its two new in-store checkout success paths.

**Tech Stack:** Expo/React Native, TypeScript, Zustand print queue, AsyncStorage settings, Node test runner.

## Global Constraints

- Defaults must preserve existing behavior: automatic in-store customer receipts are disabled by default.
- The workflow applies only after `savePosOrder` succeeds for a newly created POS in-store order paid by Cash, Card, or SmartPay.
- Never trigger the customer receipt from payment-status updates, phone pickup, marketplace/imported orders, manually added orders, edits, unpaid orders, or the realtime/global kitchen automation listener.
- Use `CustomerReceiptTemplate`, one selected saved printer, one copy, and combined mode only.
- The enabled daily time window is optional; both values are `HH:mm`, blank means all day, equal means all day, and overnight windows are supported.
- Priority means the queued customer job is selected before queued normal kitchen jobs on the same printer. An already-printing physical job is not interrupted.
- A print failure must be visible/logged but must not roll back a saved order or prevent returning from POS.

---

### Task 1: Define the persisted setting and pure eligibility helpers

**Files:**
- Create: `apps/pappas-order-management/lib/instore-customer-receipt.ts`
- Modify: `apps/pappas-order-management/lib/settings.ts`
- Create: `apps/pappas-order-management/test/instore-customer-receipt.test.ts`

**Interfaces:**
- Produces `normalizeInstoreCustomerReceiptSettings(value)` returning `{ instoreCustomerReceiptAutoPrintEnabled: boolean; instoreCustomerReceiptPrinterTarget: string | null; instoreCustomerReceiptEnabledFromTime: string | null; instoreCustomerReceiptEnabledToTime: string | null }`.
- Produces `isInstoreCustomerReceiptAutoPrintEligible(order, settings, now?)` returning `boolean`.
- Extends `AppSettings` and `DEFAULT_APP_SETTINGS` with the four settings above.
- Consumes no React Native APIs, so its behavior is covered by the Node unit test suite.

- [ ] **Step 1: Write the failing settings and eligibility tests**

```ts
test('defaults automatic in-store customer receipts to disabled with no printer or time window', () => {
  assert.deepEqual(normalizeInstoreCustomerReceiptSettings(null), {
    instoreCustomerReceiptAutoPrintEnabled: false,
    instoreCustomerReceiptPrinterTarget: null,
    instoreCustomerReceiptEnabledFromTime: null,
    instoreCustomerReceiptEnabledToTime: null,
  });
});

test('only accepts a newly-created paid POS in-store cash, card, or SmartPay order in its time window', () => {
  const settings = {
    instoreCustomerReceiptAutoPrintEnabled: true,
    instoreCustomerReceiptPrinterTarget: 'tcp:192.168.1.20:9100',
    instoreCustomerReceiptEnabledFromTime: '17:00',
    instoreCustomerReceiptEnabledToTime: '20:00',
  };
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder({ order_channel: 'instore', payment_status: 'paid', payment_method: 'store', payment_method_detail: 'Cash' }), settings, new Date('2026-08-08T18:00:00')), true);
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder({ order_channel: 'phone_pickup', payment_status: 'paid', payment_method_detail: 'Cash' }), settings, new Date('2026-08-08T18:00:00')), false);
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder({ order_channel: 'instore', payment_status: 'pending', payment_method_detail: 'Cash' }), settings, new Date('2026-08-08T18:00:00')), false);
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder({ order_channel: 'instore', payment_status: 'paid', payment_method_detail: 'Bank transfer' }), settings, new Date('2026-08-08T18:00:00')), false);
});
```

- [ ] **Step 2: Run the focused test to verify it fails for the missing module**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="in-store customer receipt"`

Expected: FAIL because `../lib/instore-customer-receipt` does not exist.

- [ ] **Step 3: Implement settings normalization and eligibility**

```ts
export function isInstoreCustomerReceiptAutoPrintEligible(
  order: Pick<Order, 'order_channel' | 'payment_status' | 'payment_method' | 'payment_method_detail'>,
  settings: InstoreCustomerReceiptSettings,
  now = new Date(),
): boolean {
  return settings.instoreCustomerReceiptAutoPrintEnabled
    && !!settings.instoreCustomerReceiptPrinterTarget
    && order.order_channel === 'instore'
    && order.payment_status === 'paid'
    && order.payment_method === 'store'
    && ['cash', 'card', 'smartpay'].includes(order.payment_method_detail?.trim().toLowerCase() || '')
    && isTimeWindowEnabled(settings.instoreCustomerReceiptEnabledFromTime, settings.instoreCustomerReceiptEnabledToTime, now);
}
```

Use the same validated `HH:mm` semantics as section printer assignments. Merge the normalized values into `loadAppSettings` and `saveAppSettings` so malformed persisted values become defaults/nulls and selected targets are trimmed or null.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="in-store customer receipt"`

Expected: PASS, including disabled, no-printer, normal-window, overnight-window, and all excluded-channel/payment cases.

- [ ] **Step 5: Commit the focused domain layer**

```bash
git add apps/pappas-order-management/lib/instore-customer-receipt.ts apps/pappas-order-management/lib/settings.ts apps/pappas-order-management/test/instore-customer-receipt.test.ts
git commit -m "feat(settings): add instore customer receipt options"
```

### Task 2: Add priority ordering to the local print queue

**Files:**
- Modify: `apps/pappas-order-management/stores/printerAutomationStore.ts`
- Modify: `apps/pappas-order-management/lib/print-queue.ts`
- Create: `apps/pappas-order-management/test/print-queue-priority.test.ts`

**Interfaces:**
- Extends `PrintJob` with `priority: 'normal' | 'customer-receipt'`.
- Extends `PreparedPrintJobInput` with optional `priority?: PrintJob['priority']`.
- `enqueuePreparedPrintJobs` passes `priority ?? 'normal'` into every queued job.
- `getReadyPendingPrintJobs()` returns the oldest queued `customer-receipt` job before normal jobs for the same printer, while still allowing different printers to print concurrently.

- [ ] **Step 1: Write the failing priority selection test**

```ts
test('selects a queued customer receipt before an older kitchen job on the same printer', () => {
  enqueue({ id: 'kitchen', priority: 'normal', printer: printerA });
  enqueue({ id: 'customer', priority: 'customer-receipt', printer: printerA });

  assert.deepEqual(getReadyPendingPrintJobs().map((job) => job.id), ['customer']);
});
```

Include a second assertion that a job already marked `printing` still blocks a later priority job on that same printer; the priority job must not preempt active hardware output.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="customer receipt before an older kitchen job"`

Expected: FAIL because the queue currently returns insertion order and has no priority field.

- [ ] **Step 3: Implement queue ordering without changing existing default behavior**

```ts
const priorityRank = (job: PrintJob) => job.priority === 'customer-receipt' ? 0 : 1;

const queuedJobs = printJobs
  .filter((job) => job.status === 'queued')
  .sort((left, right) => priorityRank(left) - priorityRank(right) || left.createdAt - right.createdAt);
```

Use this sorted sequence inside `getReadyPendingPrintJobs`; set `priority: job.priority ?? 'normal'` when creating state records so every existing call site stays normal.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="customer receipt before an older kitchen job"`

Expected: PASS, with the active-job non-preemption assertion also passing.

- [ ] **Step 5: Commit the queue behavior**

```bash
git add apps/pappas-order-management/stores/printerAutomationStore.ts apps/pappas-order-management/lib/print-queue.ts apps/pappas-order-management/test/print-queue-priority.test.ts
git commit -m "feat(print): prioritize customer receipt jobs"
```

### Task 3: Expose a dedicated priority customer-receipt print action from the provider

**Files:**
- Modify: `apps/pappas-order-management/providers/PrinterAutomationProvider.tsx`
- Create: `apps/pappas-order-management/providers/instoreCustomerReceiptPrintContext.ts`
- Create: `apps/pappas-order-management/test/instore-customer-receipt-provider.test.ts`

**Interfaces:**
- Exports `useInstoreCustomerReceiptPrint(): { printInstoreCustomerReceipt(order: Order): Promise<void> }`.
- The provider action loads current settings, checks `isInstoreCustomerReceiptAutoPrintEligible`, resolves exactly `instoreCustomerReceiptPrinterTarget`, renders `CustomerReceiptTemplate`, captures it, and enqueues one `source: 'customer-copy'`, `priority: 'customer-receipt'` job.
- The action uses the existing simulator modal for simulator printers and `enqueuePreparedPrintJobs` for physical printers; all failures are journaled/toasted and resolve without throwing to checkout.

- [ ] **Step 1: Write the failing provider wiring test**

```ts
test('provider uses the dedicated settings and queues one priority customer-copy job', () => {
  const source = readFileSync(resolve(__dirname, '../../../../providers/PrinterAutomationProvider.tsx'), 'utf8');
  assert.match(source, /isInstoreCustomerReceiptAutoPrintEligible/);
  assert.match(source, /source: 'customer-copy'/);
  assert.match(source, /priority: 'customer-receipt'/);
  assert.match(source, /CustomerReceiptTemplate/);
});
```

Add assertions that its printer resolution reads `instoreCustomerReceiptPrinterTarget` directly and that the realtime subscription contains no customer-receipt dispatch.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="provider uses the dedicated settings"`

Expected: FAIL because the provider has no dedicated action/context.

- [ ] **Step 3: Implement the provider action and context**

Render a single hidden `CustomerReceiptTemplate` job state in the provider, wait for the existing capture ref and render frames, and capture at `384` or `576` dots times the configured quality scale. Do not call `buildSectionPrintJobs`; resolve only `effectiveSettings.printerSaved.find((printer) => printer.target === effectiveSettings.instoreCustomerReceiptPrinterTarget)`. If unavailable, log a skipped decision. Wrap the action in `try/catch/finally` to clear temporary render state and report failures with `showToast`/journal rather than rejecting checkout.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="provider uses the dedicated settings"`

Expected: PASS, including assertions that global realtime auto-print remains kitchen-only.

- [ ] **Step 5: Commit the provider action**

```bash
git add apps/pappas-order-management/providers/PrinterAutomationProvider.tsx apps/pappas-order-management/providers/instoreCustomerReceiptPrintContext.ts apps/pappas-order-management/test/instore-customer-receipt-provider.test.ts
git commit -m "feat(print): add instore customer receipt action"
```

### Task 4: Add the POS register configuration controls

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`
- Create: `apps/pappas-order-management/test/instore-customer-receipt-settings-screen.test.ts`

**Interfaces:**
- Settings screen edits `instoreCustomerReceiptAutoPrintEnabled`, `instoreCustomerReceiptPrinterTarget`, `instoreCustomerReceiptEnabledFromTime`, and `instoreCustomerReceiptEnabledToTime` and passes them to `saveSettings`.
- The UI uses saved printers (including simulator printers) and explicitly displays `Combined customer receipt` as non-editable behavior.

- [ ] **Step 1: Write the failing settings-screen test**

```ts
test('printer settings expose a dedicated instore customer receipt configuration', () => {
  const source = readFileSync(resolve(__dirname, '../../../../app/(drawer)/(tabs)/settings.tsx'), 'utf8');
  assert.match(source, /In-store customer receipt/);
  assert.match(source, /instoreCustomerReceiptAutoPrintEnabled/);
  assert.match(source, /instoreCustomerReceiptPrinterTarget/);
  assert.match(source, /Combined customer receipt/);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="dedicated instore customer receipt configuration"`

Expected: FAIL because the controls do not exist.

- [ ] **Step 3: Implement the controlled settings UI and validation**

Initialize/synchronize local state from `currentSettings`; add a panel under printer print behavior with the enable switch, saved-printer selector, and From/To `TextInput`s. Reuse the current `HH:mm` and paired-window validation: reject invalid formatting or only one endpoint. Disable configuration fields when no printer capability is available and provide helper text stating that it prints one combined customer receipt before queued kitchen jobs.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="dedicated instore customer receipt configuration"`

Expected: PASS.

- [ ] **Step 5: Commit the register UI**

```bash
git add apps/pappas-order-management/app/'(drawer)'/'(tabs)'/settings.tsx apps/pappas-order-management/test/instore-customer-receipt-settings-screen.test.ts
git commit -m "feat(settings): configure instore customer receipts"
```

### Task 5: Invoke the action only from paid new POS in-store checkouts

**Files:**
- Modify: `apps/pappas-order-management/app/pos.tsx`
- Create: `apps/pappas-order-management/test/instore-customer-receipt-pos.test.ts`

**Interfaces:**
- `pos.tsx` obtains `printInstoreCustomerReceipt` from the provider context.
- Both `handleInstoreCheckout` and `handleSmartpayInstoreCheckout` await `printInstoreCustomerReceipt(result.data)` immediately after a successful save and before `router.back()`.
- No other POS creation handler or `updatePaymentStatus` path gains this call.

- [ ] **Step 1: Write the failing POS-scoping test**

```ts
test('only new paid instore checkout success paths request the automatic customer receipt', () => {
  const source = readFileSync(resolve(__dirname, '../../../../app/pos.tsx'), 'utf8');
  assert.equal((source.match(/printInstoreCustomerReceipt\(result\.data\)/g) || []).length, 2);
  assert.match(source, /handleSmartpayInstoreCheckout[\s\S]*await printInstoreCustomerReceipt\(result\.data\)/);
  assert.match(source, /handleInstoreCheckout[\s\S]*paymentStatus === 'paid'[\s\S]*await printInstoreCustomerReceipt\(result\.data\)/);
});
```

Add source-boundary assertions that phone-pickup/third-party handlers and `updatePaymentStatus` do not contain `printInstoreCustomerReceipt`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="only new paid instore checkout success paths"`

Expected: FAIL because POS does not obtain or call the provider action.

- [ ] **Step 3: Implement the two scoped calls**

In `handleSmartpayInstoreCheckout`, call the action only inside `if (result.data?.id)` after rewards are applied. In `handleInstoreCheckout`, call it in the corresponding success branch only when `paymentStatus === 'paid'`. Do not add it to any update, pickup, delivery, third-party, marketplace, or manual-order path.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="only new paid instore checkout success paths"`

Expected: PASS, proving the call count and explicit exclusions.

- [ ] **Step 5: Run the complete verification suite**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS with zero TypeScript and test failures.

- [ ] **Step 6: Commit the POS integration**

```bash
git add apps/pappas-order-management/app/pos.tsx apps/pappas-order-management/test/instore-customer-receipt-pos.test.ts
git commit -m "feat(pos): print paid instore customer receipts"
```
