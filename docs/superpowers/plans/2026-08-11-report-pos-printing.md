# Report POS Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Print the selected report period as a data-only 80 mm receipt, after the user chooses a saved printer for every print.

**Architecture:** A pure `report-printing` model builder converts the selected-period report data into a receipt-ready snapshot with no comparison information. A new `ReportPrintTemplate` renders that snapshot off-screen at 576 dots; `report.tsx` captures the template with the existing view-shot helper and sends it either to the existing simulator or the existing image-based ESC/POS transport.

**Tech Stack:** Expo/React Native, React Native Paper, react-native-view-shot, existing `captureReceiptForPrinter`, existing `escposPrintOrderImage`, Node test runner, TypeScript.

## Global Constraints

- Print only selected-period data; never include comparison totals, comparison labels, or charts.
- The report receipt is always 80 mm / 576 dots, independent of the kitchen paper-width setting.
- Use image capture and `escposPrintOrderImage`; do not introduce raw text printing, Expo Print, or HTML printing.
- Ask the user to choose from saved printers on every print; do not persist a report-printer preference.
- A saved simulator printer must preview the same captured image in `PrintSimulatorModal`.
- Reuse the existing printer queue, Epson/raw-TCP transport behavior, error formatting, and high-quality capture setting.

---

## File Structure

- Create `apps/pappas-order-management/lib/report-printing.ts`: pure receipt snapshot types, selected-period aggregation, money/date formatting, and 576-dot constants.
- Create `apps/pappas-order-management/components/ReportPrintTemplate.tsx`: data-only 80 mm capture view consuming a `ReportPrintSnapshot` and store name.
- Create `apps/pappas-order-management/test/report-printing.test.ts`: unit coverage of Daily, Weekly, and Monthly snapshot contents.
- Modify `apps/pappas-order-management/tsconfig.test.json`: include the new pure module and test in the emitted unit-test project.
- Modify `apps/pappas-order-management/components/PrintSimulatorModal.tsx`: accept optional generic title/subtitle props while preserving all order receipt callers.
- Modify `apps/pappas-order-management/app/(drawer)/report.tsx`: build the selected-period snapshot, present the saved-printer picker, capture/print the hidden template, and show simulator output.

### Task 1: Build and test the pure report receipt snapshot

**Files:**
- Create: `apps/pappas-order-management/lib/report-printing.ts`
- Create: `apps/pappas-order-management/test/report-printing.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Consumes: `Order`, `getOrderGrossSales`, `isMarketplaceSalesOrder`, `buildChannelFinancialBreakdown`, `formatDateToLocalISO`, `getOrderChannelLabel`, and `getPaymentStatLabel`.
- Produces: `REPORT_RECEIPT_WIDTH = 576`, `type ReportPrintType = 'daily' | 'weekly' | 'monthly'`, `type ReportPrintSnapshot`, and `buildReportPrintSnapshot(input): ReportPrintSnapshot`.

- [ ] **Step 1: Write the failing snapshot test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportPrintSnapshot } from '../lib/report-printing';

test('weekly report snapshot includes selected-period summary and date rows only', () => {
  const snapshot = buildReportPrintSnapshot({
    reportType: 'weekly',
    periodLabel: 'Mon 3 Aug 2026 - Sun 9 Aug 2026',
    generatedAt: new Date('2026-08-10T01:00:00.000Z'),
    orders: [paidStoreOrder, paidUberOrder, cancelledOrder],
  });

  assert.deepEqual(snapshot.summary, {
    grossSales: 35,
    paidOrders: 2,
    averageOrder: 17.5,
    discounts: 3,
  });
  assert.deepEqual(snapshot.salesByDate, [
    { label: 'Mon 3 Aug', total: 20 },
    { label: 'Tue 4 Aug', total: 15 },
  ]);
  assert.equal(snapshot.paymentBreakdown.length, 2);
  assert.equal(snapshot.channelFinancials.length, 3);
  assert.equal('compareTotal' in snapshot, false);
});

test('daily report snapshot omits date rows and still returns zero-value summary', () => {
  const snapshot = buildReportPrintSnapshot({
    reportType: 'daily',
    periodLabel: 'Mon 10 Aug 2026',
    generatedAt: new Date('2026-08-10T01:00:00.000Z'),
    orders: [],
  });

  assert.equal(snapshot.salesByDate, null);
  assert.deepEqual(snapshot.summary, { grossSales: 0, paidOrders: 0, averageOrder: 0, discounts: 0 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL because `../lib/report-printing` does not exist.

- [ ] **Step 3: Implement the model builder**

```ts
export const REPORT_RECEIPT_WIDTH = 576;

export type ReportPrintSnapshot = {
  reportType: 'daily' | 'weekly' | 'monthly';
  reportLabel: string;
  periodLabel: string;
  generatedAt: string;
  summary: { grossSales: number; paidOrders: number; averageOrder: number; discounts: number };
  salesByDate: Array<{ label: string; total: number }> | null;
  paymentBreakdown: Array<{ label: string; orders: number; total: number }>;
  channelBreakdown: Array<{ label: string; orders: number; total: number }>;
  channelFinancials: ReturnType<typeof buildChannelFinancialBreakdown>;
};

export function buildReportPrintSnapshot({ reportType, periodLabel, generatedAt, orders }: {
  reportType: ReportPrintType; periodLabel: string; generatedAt: Date; orders: Order[];
}): ReportPrintSnapshot {
  // Filter with isMarketplaceSalesOrder, aggregate only this `orders` array,
  // and return date rows only when reportType is not 'daily'.
}
```

Implement local pure helpers for paid orders, discounts, breakdown grouping, and date labels rather than importing them from the screen. Use `formatDateToLocalISO(new Date(order.created_at))` as the date grouping key, sort date rows ascending, and format their labels as `Mon 3 Aug`. Use `REPORT_LABELS` equivalent values `Sales report`, `Weekly sales`, and `Monthly sales` in the returned `reportLabel`.

- [ ] **Step 4: Add the files to the test compiler and run the focused test**

Add these exact entries to `tsconfig.test.json` `include`:

```json
"lib/report-printing.ts",
"test/report-printing.test.ts"
```

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS with both snapshot tests passing.

- [ ] **Step 5: Commit the model and tests**

```bash
git add apps/pappas-order-management/lib/report-printing.ts apps/pappas-order-management/test/report-printing.test.ts apps/pappas-order-management/tsconfig.test.json
git commit -m "feat(report): add printable report snapshot"
```

### Task 2: Add the dedicated 80 mm report template

**Files:**
- Create: `apps/pappas-order-management/components/ReportPrintTemplate.tsx`

**Interfaces:**
- Consumes: `ReportPrintSnapshot` and `REPORT_RECEIPT_WIDTH` from `@/lib/report-printing`, plus `storeName: string`.
- Produces: `ReportPrintTemplate({ snapshot, storeName }): JSX.Element`, renderable inside a view-shot ref.

- [ ] **Step 1: Add a source-level template contract test**

Append this test to `apps/pappas-order-management/test/report-printing.test.ts`:

```ts
import { readFileSync } from 'node:fs';

test('report template contains only data receipt sections', () => {
  const source = readFileSync('components/ReportPrintTemplate.tsx', 'utf8');
  assert.match(source, /Summary/);
  assert.match(source, /Gross sales by date/);
  assert.match(source, /Payment method/);
  assert.match(source, /Channel financials/);
  assert.doesNotMatch(source, /LineChart|ComparisonChart|Compare/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL because `components/ReportPrintTemplate.tsx` does not exist.

- [ ] **Step 3: Implement the template**

```tsx
export function ReportPrintTemplate({ snapshot, storeName }: {
  snapshot: ReportPrintSnapshot;
  storeName: string;
}) {
  return (
    <View style={styles.receipt}>
      <Text style={styles.storeName}>{storeName}</Text>
      <Text style={styles.title}>{snapshot.reportLabel}</Text>
      <Text style={styles.period}>{snapshot.periodLabel}</Text>
      <ReceiptDivider />
      <ReceiptSection title="Summary">{/* gross sales, paid orders, average order, discounts */}</ReceiptSection>
      {snapshot.salesByDate ? <ReceiptSection title="Gross sales by date">{/* label/total rows */}</ReceiptSection> : null}
      <ReceiptSection title="Payment method">{/* label, order count, total */}</ReceiptSection>
      <ReceiptSection title="Channel">{/* label, order count, total */}</ReceiptSection>
      <ReceiptSection title="Channel financials">{/* gross, payout, commission, net */}</ReceiptSection>
    </View>
  );
}
```

Set the outer view width to `REPORT_RECEIPT_WIDTH`, white background, black text, compact receipt typography, and fixed divider/section spacing. Render `N/A` for null financial metrics. Format money with `$${Math.round(value).toLocaleString('en-AU')}` and show the generated timestamp beneath the period. Use only `View`, `Text`, and `StyleSheet` so the hidden view is capture-safe.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- report-printing.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the template**

```bash
git add apps/pappas-order-management/components/ReportPrintTemplate.tsx apps/pappas-order-management/test/report-printing.test.ts
git commit -m "feat(report): add 80mm report print template"
```

### Task 3: Generalize the existing simulator title without changing receipt callers

**Files:**
- Modify: `apps/pappas-order-management/components/PrintSimulatorModal.tsx`
- Modify: `apps/pappas-order-management/test/image-only-printing.test.ts`

**Interfaces:**
- Consumes: optional `title?: string` and `subtitle?: string` added to `PrintSimulatorModalProps`.
- Produces: generic simulator heading when props are supplied, otherwise the exact current order-based heading/subtitle.

- [ ] **Step 1: Write the failing compatibility test**

Append this test to `apps/pappas-order-management/test/image-only-printing.test.ts`:

```ts
test('print simulator supports a generic title while preserving order fallback copy', () => {
  const source = source('components/PrintSimulatorModal.tsx');
  assert.match(source, /title\?: string/);
  assert.match(source, /subtitle\?: string/);
  assert.match(source, /title \|\| 'Print Simulation'/);
  assert.match(source, /subtitle \|\| `Order #\$\{/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL because `PrintSimulatorModalProps` has no generic title/subtitle props.

- [ ] **Step 3: Implement the optional copy overrides**

```tsx
interface PrintSimulatorModalProps {
  // existing props
  title?: string;
  subtitle?: string;
}

const simulatorTitle = title || 'Print Simulation';
const simulatorSubtitle = subtitle || `Order #${order ? getFriendlyOrderNumber(order.order_number) : ''}`;
```

Render `simulatorTitle` and `simulatorSubtitle` in the current header. Do not change `order`, image labels, sharing behavior, or any existing call site.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

- [ ] **Step 5: Commit the simulator compatibility update**

```bash
git add apps/pappas-order-management/components/PrintSimulatorModal.tsx apps/pappas-order-management/test/image-only-printing.test.ts
git commit -m "feat(print): support generic simulator previews"
```

### Task 4: Wire printer selection, capture, simulator preview, and physical printing into Report

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/report.tsx`
- Modify: `apps/pappas-order-management/test/image-only-printing.test.ts`

**Interfaces:**
- Consumes: `buildReportPrintSnapshot`, `REPORT_RECEIPT_WIDTH`, `ReportPrintTemplate`, `useStoreInfo`, `useAppSettingsQuery`, `captureReceiptForPrinter`, `captureReceiptPreview`, `escposPrintOrderImage`, `formatPrinterError`, `isSimulatorPrinter`, `SavedPrinter`, and generic `PrintSimulatorModal` props.
- Produces: a `Print report` action that chooses one saved printer for each invocation and prints exactly one selected-period report image.

- [ ] **Step 1: Write the failing report-print flow source test**

Append to `apps/pappas-order-management/test/image-only-printing.test.ts`:

```ts
test('report printing uses the existing image capture and printer transport at 80mm', () => {
  const source = source('app/(drawer)/report.tsx');
  assert.match(source, /ReportPrintTemplate/);
  assert.match(source, /captureReceiptForPrinter/);
  assert.match(source, /escposPrintOrderImage/);
  assert.match(source, /REPORT_RECEIPT_WIDTH/);
  assert.match(source, /isSimulatorPrinter/);
  assert.doesNotMatch(source, /Print\.printAsync|generatePrintHTML/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL because the Report screen has no report print flow.

- [ ] **Step 3: Add Report screen state and imports**

Add the existing hooks/helpers and these states:

```tsx
const reportReceiptRef = useRef<View>(null);
const [showPrinterPicker, setShowPrinterPicker] = useState(false);
const [isPrintingReport, setIsPrintingReport] = useState(false);
const [showReportSimulator, setShowReportSimulator] = useState(false);
const [reportPreviewUri, setReportPreviewUri] = useState<string | null>(null);
const { data: appSettings = DEFAULT_APP_SETTINGS } = useAppSettingsQuery();
const storeInfo = useStoreInfo();
```

Build `reportPrintSnapshot` with `useMemo` from `selectedReport`, `periodTitle`, and `currentOrders`. Keep it based on selected-period orders only; never pass `compareOrders`, `compareRange`, `difference`, or comparison labels into the model.

- [ ] **Step 4: Add the always-select printer picker and print handler**

Use a modal that lists `appSettings.printerSaved` as pressable rows with printer name and transport label. The Print button only calls `setShowPrinterPicker(true)`; it must not select a default printer. For an empty list, show `No saved printers. Add a printer in Settings before printing a report.` and provide only Close.

```tsx
const printReportToPrinter = async (printer: SavedPrinter) => {
  try {
    setIsPrintingReport(true);
    setShowPrinterPicker(false);
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!reportReceiptRef.current) throw new Error('Report receipt is not ready yet.');
    if (isSimulatorPrinter(printer)) {
      const previewUri = await captureReceiptPreview(reportReceiptRef.current, REPORT_RECEIPT_WIDTH);
      setReportPreviewUri(previewUri);
      setShowReportSimulator(true);
      return;
    }
    const image = await captureReceiptForPrinter(
      reportReceiptRef.current,
      printer,
      REPORT_RECEIPT_WIDTH,
      appSettings.printerHighQuality
    );
    await escposPrintOrderImage(image, printer, 1, REPORT_RECEIPT_WIDTH);
    Alert.alert('Printed', `Report sent to ${printer.deviceName}.`);
  } catch (error) {
    Alert.alert('Print error', formatPrinterError(error));
  } finally {
    setIsPrintingReport(false);
  }
};
```

- [ ] **Step 5: Mount the hidden template and simulator modal**

Mount the template only while `isPrintingReport` is true, matching the current receipt-capture pattern:

```tsx
{isPrintingReport ? (
  <View style={styles.hiddenReceiptContainer} pointerEvents="none">
    <View ref={reportReceiptRef} collapsable={false}>
      <ReportPrintTemplate snapshot={reportPrintSnapshot} storeName={storeInfo.shopName} />
    </View>
  </View>
) : null}

<PrintSimulatorModal
  visible={showReportSimulator}
  order={null}
  imageUri={reportPreviewUri}
  title="Report print simulation"
  subtitle={reportPrintSnapshot.periodLabel}
  onClose={() => setShowReportSimulator(false)}
/>
```

Add `hiddenReceiptContainer` to position the view off-screen without `display: 'none'`, and ensure the `Print report` action is disabled when `loading`, `refreshing`, or `isPrintingReport` is true.

- [ ] **Step 6: Run affected tests and type-checking**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

Run: `pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: PASS with no TypeScript errors.

- [ ] **Step 7: Manually verify simulator and printer behavior**

1. Add or retain a saved simulator printer and a saved physical printer.
2. Open each Daily, Weekly, and Monthly report, then tap **Print report**.
3. Confirm the picker appears each time and has no preselected/default action.
4. Select the simulator; confirm the preview has store name, selected period, summary, payment/channel sections, channel financials, no chart, no comparison values, and date rows only for Weekly/Monthly.
5. Select a physical printer; confirm it receives a single 576-dot image print and errors are shown as alerts if disconnected.

- [ ] **Step 8: Commit the Report screen integration**

```bash
git add apps/pappas-order-management/app/'(drawer)'/report.tsx apps/pappas-order-management/test/image-only-printing.test.ts
git commit -m "feat(report): print selected period to POS"
```

### Task 5: Final regression verification

**Files:**
- Verify only; no planned source changes.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: evidence that the report print feature meets the approved design without regressing image-only receipt printing.

- [ ] **Step 1: Inspect the final diff for scope violations**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; the staged/uncommitted scope contains no printer transport rewrite or settings persistence.

- [ ] **Step 2: Run the complete test suite again**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

- [ ] **Step 3: Run TypeScript checking again**

Run: `pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 4: Commit any final test-only corrections, if required**

If the verification steps require changes, stage only the corrected report-print files and tests, then run:

```bash
git commit -m "test(report): verify POS print workflow"
```
