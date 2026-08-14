# In-store Instant Ticket and SmartPay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Print a direct text-only in-store ticket with the real order number and preserve one pending order through SmartPay retries and cash fallback.

**Architecture:** Reuse the current `pending_online_payment` staging state. A pure instant-ticket module owns setting normalization, eligibility and text document construction; PrinterAutomationProvider sends it directly without a rendered image. POS saves/reuses a pending in-store order before starting the existing 2-second SmartPay poll, then updates that exact ID only on accepted payment.

**Tech Stack:** Expo React Native, TypeScript, React Native Paper, Supabase, native ESC/POS/Epson SDK and raw TCP printing, Node test runner.

## Global Constraints

- Reuse `pending_online_payment`; do not add a status/database migration.
- Preserve the existing SmartPay minimum 2-second polling interval and 180-second default timeout.
- Instant tickets must contain a prominent friendly order number and item names only: no raster capture, modifiers, notes, prices, totals, or customer data.
- Instant ticket and current image customer receipt have independent switches/targets and may both run.
- No kitchen/customer automatic print occurs until the pending order becomes paid/confirmed.
- A failed or cancelled transaction retains one pending order that SmartPay retry, Cash or Card must update rather than duplicate.

---

## Files

- Create `apps/pappas-order-management/lib/instore-instant-ticket.ts` for ticket settings/job eligibility and `EscPosDocument` construction.
- Modify `apps/pappas-order-management/lib/settings.ts` to store `instoreInstantTicketEnabled` and `instoreInstantTicketPrinterTarget`, defaulting to `false`/`null`.
- Modify `apps/pappas-order-management/lib/escpos-printer.ts` to export `escposPrintDocument(document, printer)`, routed through the existing per-printer queue with raw TCP bytes or Epson text commands.
- Modify `apps/pappas-order-management/providers/instoreCustomerReceiptPrintContext.ts` and `providers/PrinterAutomationProvider.tsx` to expose and execute `printInstoreInstantTicket(order)` with journal/toast reporting.
- Modify `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx` for its independent toggle/target selector.
- Create `apps/pappas-order-management/lib/instore-smartpay-checkout.ts` for dependency-injected pending-order create/reuse/settlement logic.
- Modify `apps/pappas-order-management/app/pos.tsx` and `components/pos/PosDialogs.tsx` to show the persisted number and reuse the pending order.
- Create `test/instore-instant-ticket.test.ts` and `test/instore-smartpay-checkout.test.ts`; modify `test/order-payment-status.test.ts`.

### Task 1: Add pure ticket settings and content

**Files:** Create `lib/instore-instant-ticket.ts`, create `test/instore-instant-ticket.test.ts`, modify `lib/settings.ts`.

**Produces:**

```ts
type InstoreInstantTicketSettings = {
  instoreInstantTicketEnabled: boolean;
  instoreInstantTicketPrinterTarget: string | null;
};
function normalizeInstoreInstantTicketSettings(value: unknown): InstoreInstantTicketSettings;
function getInstoreInstantTicketPrintJob(order: Pick<Order, 'order_channel' | 'payment_method'>, settings: InstoreInstantTicketSettings, savedTargets: string[]): { printerTarget: string; priority: 'instant-ticket' } | null;
function buildInstoreInstantTicketDocument(order: Pick<Order, 'order_number' | 'items'>): EscPosDocument;
```

- [ ] **Step 1: Write failing tests**

```ts
test('defaults instant tickets to disabled with no target', () => {
  assert.deepEqual(normalizeInstoreInstantTicketSettings(null), {
    instoreInstantTicketEnabled: false, instoreInstantTicketPrinterTarget: null,
  });
});
test('creates a text-only ticket without customisations', () => {
  const doc = buildInstoreInstantTicketDocument(makeOrder({ order_number: 'ORD-123', items: [{ product_name: 'Fish Burger', comment: 'No salt', addons: [{ addon_item_name: 'Cheese' }] }] }));
  const text = doc.nodes.map((node) => node.type === 'text' ? node.text : '').join('\n');
  assert.match(text, /ORDER #123/); assert.match(text, /Fish Burger/); assert.doesNotMatch(text, /No salt|Cheese/);
  assert.equal(doc.nodes.some((node) => node.type === 'image'), false);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter pappas-order-management test -- instore-instant-ticket.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the smallest interface**

```ts
export function buildInstoreInstantTicketDocument(order: Pick<Order, 'order_number' | 'items'>): EscPosDocument {
  return { nodes: [
    buildTextNode(`ORDER #${getFriendlyOrderNumber(order.order_number)}\n`, { align: 'center', width: 2, height: 2 }),
    buildFeedNode(),
    ...order.items.map((item) => buildTextNode(`${item.product_name}\n`)),
    buildFeedNode(3), buildCutNode(),
  ] };
}
```

Add/normalize/save the two settings in `AppSettings` using the existing customer-receipt pattern.

- [ ] **Step 4: Verify**

Run: `pnpm --filter pappas-order-management test -- instore-instant-ticket.test.ts && pnpm --filter pappas-order-management type-check`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/pappas-order-management/lib/instore-instant-ticket.ts apps/pappas-order-management/lib/settings.ts apps/pappas-order-management/test/instore-instant-ticket.test.ts && git commit -m "feat: define instant ticket settings and content"`

### Task 2: Add direct text transport and provider/UI integration

**Files:** Modify `lib/escpos-printer.ts`, `providers/instoreCustomerReceiptPrintContext.ts`, `providers/PrinterAutomationProvider.tsx`, `app/(drawer)/(tabs)/settings.tsx`, and `test/instore-instant-ticket.test.ts`.

**Consumes:** Task 1's `EscPosDocument`, eligibility function and setting fields.

**Produces:** `escposPrintDocument(document: EscPosDocument, printer: SavedPrinter): Promise<void>` and context value `{ printInstoreCustomerReceipt, printInstoreInstantTicket }`.

- [ ] **Step 1: Add a failing encoding regression test**

```ts
test('encodes the ticket without a raster image command', () => {
  const bytes = buildDocumentPrintJob(buildInstoreInstantTicketDocument(makeOrder()));
  assert.equal(bytes.includes(0x2a), false); // ESC * is a bit-image command
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm --filter pappas-order-management test -- instore-instant-ticket.test.ts`

Expected: FAIL until the document imports/encoder are wired.

- [ ] **Step 3: Implement direct print path**

```ts
export async function escposPrintDocument(document: EscPosDocument, printer: SavedPrinter): Promise<void> {
  assertPrinter(printer);
  if (isSimulatorPrinter(printer)) throw new Error('Instant tickets require a physical printer.');
  return enqueuePrinterJob(printer, async () => {
    if (getPrinterDriver(printer) === 'rawTcp') {
      await withRawTcpPrinter(printer, (socket) => writeRawBytes(socket, buildDocumentPrintJob(document)), { timeoutMs: 30000 });
      return;
    }
    await withConnectedPrinter(printer, async (device) => {
      for (const node of document.nodes) {
        if (node.type === 'text') await device.addText(node.text);
        if (node.type === 'feed') await device.addText('\n'.repeat(node.lines));
        if (node.type === 'cut') await device.addCut();
      }
      await device.sendData();
    }, { timeoutMs: 30000 });
  });
}
```

Provider behavior: reload settings, resolve the selected saved target, skip/notify a disabled or simulator target without blocking payment, then call `escposPrintDocument`. Add `instore-instant-ticket` journal records at dispatch, success and failure. In Settings add the independent “In-store instant ticket” switch, helper copy, and saved-printer button group bound only to the new target.

- [ ] **Step 4: Verify**

Run: `pnpm --filter pappas-order-management test -- instore-instant-ticket.test.ts && pnpm --filter pappas-order-management type-check`

Expected: PASS and the instant-ticket files do not import `captureReceiptForPrinter`.

- [ ] **Step 5: Commit**

Run: `git add apps/pappas-order-management/lib/escpos-printer.ts apps/pappas-order-management/providers/instoreCustomerReceiptPrintContext.ts apps/pappas-order-management/providers/PrinterAutomationProvider.tsx apps/pappas-order-management/app/'(drawer)'/'(tabs)'/settings.tsx apps/pappas-order-management/test/instore-instant-ticket.test.ts && git commit -m "feat: print instant POS tickets directly"`

### Task 3: Extract and test SmartPay pending-order lifecycle

**Files:** Create `lib/instore-smartpay-checkout.ts`, create `test/instore-smartpay-checkout.test.ts`, modify `test/order-payment-status.test.ts`.

**Produces:**

```ts
function createOrReusePendingInstoreOrder(deps: { savePosOrder: typeof savePosOrder }, request: PendingInstoreOrderRequest): Promise<{ order: Order; created: boolean }>;
function settlePendingInstorePayment(deps: { updatePaymentStatus: typeof updatePaymentStatus }, orderId: string, detail: 'SmartPay' | 'Cash' | 'Card'): Promise<Order>;
```

- [ ] **Step 1: Write failing lifecycle tests**

```ts
test('saves one pending in-store order before SmartPay starts', async () => {
  const result = await createOrReusePendingInstoreOrder(deps, request);
  assert.equal(result.created, true); assert.equal(saveCalls.length, 1);
  assert.equal(saveCalls[0].payment_status, 'pending');
});
test('reuses the pending order for retry and cash fallback', async () => {
  const result = await createOrReusePendingInstoreOrder(deps, { ...request, existingOrder: pendingOrder });
  await settlePendingInstorePayment(deps, result.order.id, 'Cash');
  assert.equal(saveCalls.length, 0); assert.deepEqual(updateCalls, [[pendingOrder.id, 'paid', 'Cash']]);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter pappas-order-management test -- instore-smartpay-checkout.test.ts`

Expected: FAIL because the lifecycle module does not exist.

- [ ] **Step 3: Implement the pure workflow**

For a new order call `savePosOrder` once with full cart items, `order_channel: 'instore'`, `payment_method: 'store'`, `payment_status: 'pending'`, `payment_method_detail: 'SmartPay'`, and `order_status: 'pending_online_payment'`. Return `existingOrder` without saving when it is present and still pending. Settlement calls `updatePaymentStatus(orderId, 'paid', detail)` and throws on a missing result. Extend payment-status tests to prove only a `paid` update turns `pending_online_payment` into `confirmed`; a pending/failed result remains non-printable.

- [ ] **Step 4: Verify**

Run: `pnpm --filter pappas-order-management test -- instore-smartpay-checkout.test.ts order-payment-status.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/pappas-order-management/lib/instore-smartpay-checkout.ts apps/pappas-order-management/test/instore-smartpay-checkout.test.ts apps/pappas-order-management/test/order-payment-status.test.ts && git commit -m "feat: reuse pending SmartPay orders"`

### Task 4: Integrate pending lifecycle and ticket number into POS

**Files:** Modify `app/pos.tsx` and `components/pos/PosDialogs.tsx`.

**Consumes:** Task 2's `printInstoreInstantTicket`; Task 3's create/reuse/settle functions.

- [ ] **Step 1: Add a failing dialog-focused test or extract a pure display helper**

```ts
test('returns the friendly ticket number only for a persisted SmartPay order', () => {
  assert.equal(getSmartpayDisplayOrderNumber({ order_number: 'ORD-123' } as Order), '123');
  assert.equal(getSmartpayDisplayOrderNumber(null), null);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `pnpm --filter pappas-order-management test -- instore-smartpay-checkout.test.ts`

Expected: FAIL until the helper is exported.

- [ ] **Step 3: Integrate the real order state**

Add `pendingInstoreSmartpayOrder: Order | null`. Before terminal payment, create/reuse it; call `void printInstoreInstantTicket(order)` after save; set it before `setSmartpayProcessing(true)`. On approval settle that ID with `SmartPay`, award reward points once for that order, print the existing customer receipt, clear pending state, then navigate back. On failure/cancel/timeout clear only the processing lock and retain pending state/cart. When staff selects Cash or Card while that pending state exists, settle that ID with the selected detail, award once, print the customer receipt, clear pending state and navigate back without calling `savePosOrder`. Pass `pendingInstoreSmartpayOrder?.order_number ?? null` into `PosDialogs`; render `Order #<friendly number>` below the wait message and above the amount.

- [ ] **Step 4: Verify**

Run: `pnpm --filter pappas-order-management test -- instore-smartpay-checkout.test.ts order-payment-status.test.ts && pnpm --filter pappas-order-management type-check`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/pappas-order-management/app/pos.tsx apps/pappas-order-management/components/pos/PosDialogs.tsx apps/pappas-order-management/lib/instore-smartpay-checkout.ts apps/pappas-order-management/test/instore-smartpay-checkout.test.ts && git commit -m "feat: show SmartPay ticket number while waiting"`

### Task 5: Complete verification

**Files:** Modify only a concrete defect uncovered by these checks.

- [ ] **Step 1: Run all focused automated checks**

Run: `pnpm --filter pappas-order-management test -- instore-instant-ticket.test.ts instore-smartpay-checkout.test.ts instore-customer-receipt.test.ts order-payment-status.test.ts && pnpm --filter pappas-order-management type-check && git diff --check`

Expected: PASS with no whitespace errors.

- [ ] **Step 2: Perform device smoke test**

1. Enable instant ticket and image customer receipt on separate physical saved printers.
2. Start SmartPay: confirm a real order number appears immediately and the text ticket arrives before the terminal resolves.
3. Approve: confirm exactly one detailed customer receipt and normal post-payment kitchen automation.
4. Cancel a second terminal transaction, retry then use Cash: confirm the same order number/ID is settled and no duplicate pending order or ticket is created.

- [ ] **Step 3: Commit a verification fix only when needed**

Run: `git diff --name-only`; stage only the files changed to correct the observed verification failure, then commit with `git commit -m "fix: correct instant ticket SmartPay flow"`.
