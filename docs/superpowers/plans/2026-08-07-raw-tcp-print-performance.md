# Raw TCP Print Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a measured Android raw-TCP print baseline and add a non-printing raw-capture equivalence diagnostic without changing production printer output.

**Architecture:** Move PNG/raw decoding, resizing, and ESC/POS raster generation into a pure module that returns payload bytes and phase metrics. Keep `escpos-printer.ts` responsible for socket/driver transport and `printer-image.ts` responsible for native capture. Production raw-TCP continues to capture and send PNG-derived payloads; Android diagnostics prepare a raw candidate only for an exact byte comparison.

**Tech Stack:** Expo/React Native, TypeScript, Node built-in test runner, `react-native-view-shot`, `pako`, `react-native-tcp-socket`.

## Global Constraints

- PNG remains the default and only production payload for raw-TCP printing.
- Do not alter ESC/POS commands, 180 luminance threshold, paper width, route order, or per-printer serialization.
- Do not send raw candidate bytes during diagnostic runs.
- Android only for native raw capture; retain PNG behavior on iOS.
- Capture jobs sharing the mounted receipt view remain sequential; different printer queues may run concurrently as they do now.
- Preserve the user’s untracked `apps/pappas-order-management/lib/epson-epos.ts` file.

---

## File Structure

- Create `apps/pappas-order-management/lib/escpos-raster.ts`: pure PNG/raw decoding, resize, ESC/POS payload generation, exact-byte comparison, and phase metrics.
- Modify `apps/pappas-order-management/lib/escpos-printer.ts`: delegate raw-TCP payload preparation to the pure module and journal baseline metrics without changing transport behavior.
- Modify `apps/pappas-order-management/lib/printer-image.ts`: capture a raw Android candidate with explicit metadata parsing; production capture APIs remain unchanged.
- Modify `apps/pappas-order-management/lib/print-queue.ts`: carry an optional diagnostic candidate and journal its comparison without printing it.
- Modify `apps/pappas-order-management/stores/printerAutomationStore.ts`: add explicit, default-off diagnostic state and journal-safe result metadata.
- Modify `apps/pappas-order-management/providers/PrinterAutomationProvider.tsx`: request paired diagnostic capture only after the receipt is settled and only for configured raw-TCP jobs.
- Modify `apps/pappas-order-management/tsconfig.test.json`: include new pure modules in the Node test build.
- Create `apps/pappas-order-management/test/escpos-raster.test.ts`: byte-equivalence, malformed-data, and metric tests.
- Create `apps/pappas-order-management/test/raw-tcp-diagnostic.test.ts`: static/behavioral guard that the candidate cannot become the sent image source.

### Task 1: Create Pure ESC/POS Raster Preparation With PNG Baseline

**Files:**

- Create: `apps/pappas-order-management/lib/escpos-raster.ts`
- Create: `apps/pappas-order-management/test/escpos-raster.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**

- Consumes: `decodePngRgba(pngBytes)` from `lib/png.ts`.
- Produces: `prepareEscPosImage(source, maxWidth): Promise<PreparedEscPosImage>` and `compareEscPosPayloads(reference, candidate): PayloadComparison`.
- `PreparedEscPosImage` contains `bytes: Uint8Array`, `width`, `height`, `sourceByteLength`, and `phasesMs: { decode, resize, raster, total }`.

- [ ] **Step 1: Write the failing raster-equivalence tests**

```ts
test('prepares equivalent PNG RGBA and ARGB sources as identical ESC/POS payloads', async () => {
  const png = makePngFixture([255, 255, 255, 255, 0, 0, 0, 255]);
  const fromPng = await prepareEscPosImage({ kind: 'png-base64', base64: encodeBase64(png) }, 8);
  const fromRaw = await prepareEscPosImage({ kind: 'raw-argb', width: 2, height: 1, argb: Uint8Array.from([255, 255, 255, 255, 255, 0, 0, 0]) }, 8);

  assert.deepEqual(fromRaw.bytes, fromPng.bytes);
  assert.equal(compareEscPosPayloads(fromPng.bytes, fromRaw.bytes).equal, true);
});

test('rejects raw pixel data that does not match its dimensions', async () => {
  await assert.rejects(() => prepareEscPosImage({ kind: 'raw-argb', width: 2, height: 1, argb: Uint8Array.of(255) }, 8), /expected 8 bytes/i);
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- escpos-raster.test.js`

Expected: FAIL because `lib/escpos-raster.ts` and its exports do not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export type RasterImageSource =
  | { kind: 'png-base64'; base64: string }
  | { kind: 'raw-argb'; width: number; height: number; argb: Uint8Array };

export async function prepareEscPosImage(source: RasterImageSource, maxWidth: number): Promise<PreparedEscPosImage> {
  // Decode source, validate raw length, and retain existing resize, threshold,
  // 24-dot ESC * raster layout, header, footer, and yielding behavior.
}
```

Move the existing pure base64 decode, ARGB-to-RGBA conversion, resize, raster, and wrapping logic from `escpos-printer.ts` without changing their output. Record phase boundaries with `Date.now()`. Include `lib/escpos-raster.ts` and `lib/png.ts` in the Node test build.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- escpos-raster.test.js`

Expected: PASS with equivalence and malformed-input tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/lib/escpos-raster.ts apps/pappas-order-management/test/escpos-raster.test.ts apps/pappas-order-management/tsconfig.test.json
git commit -m "feat(print): add measurable ESC POS raster preparation"
```

### Task 2: Retain Production PNG Output and Record Its Baseline

**Files:**

- Modify: `apps/pappas-order-management/lib/escpos-printer.ts`
- Modify: `apps/pappas-order-management/lib/print-queue.ts`
- Modify: `apps/pappas-order-management/test/escpos-raster.test.ts`

**Interfaces:**

- Consumes: `prepareEscPosImage({ kind: 'png-base64', base64 }, width)` from Task 1.
- Produces: `RawTcpPrintMetrics` recorded in queue journal entries.

- [ ] **Step 1: Write the failing metric test**

```ts
test('reports decode resize raster and total timing for a PNG preparation', async () => {
  const png = makePngFixture([255, 255, 255, 255, 0, 0, 0, 255]);
  const prepared = await prepareEscPosImage({ kind: 'png-base64', base64: encodeBase64(png) }, 8);

  assert.deepEqual(Object.keys(prepared.phasesMs), ['decode', 'resize', 'raster', 'total']);
  assert.ok(prepared.phasesMs.total >= prepared.phasesMs.decode);
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- escpos-raster.test.js`

Expected: FAIL because phase metrics are absent or incomplete.

- [ ] **Step 3: Delegate production raw-TCP preparation while retaining its PNG input**

Replace only `buildRawImagePrintBytes` internals with `prepareEscPosImage`. It must pass `png-base64` for the existing raw-TCP source and return exactly the prepared bytes. Expose metrics to `processPendingPrintJob`, then record one journal entry containing capture type, decode, resize, raster, total, source bytes, and raster bytes before socket send. Keep socket-send timing in the existing completion entry.

- [ ] **Step 4: Run focused and full unit tests**

Run: `pnpm --filter pappas-order-management test:unit -- escpos-raster.test.js`

Expected: PASS.

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS with no regression failures.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/lib/escpos-printer.ts apps/pappas-order-management/lib/print-queue.ts apps/pappas-order-management/test/escpos-raster.test.ts
git commit -m "feat(print): record raw TCP PNG preparation baseline"
```

### Task 3: Add Validated Android Raw Candidate Capture

**Files:**

- Modify: `apps/pappas-order-management/lib/printer-image.ts`
- Modify: `apps/pappas-order-management/lib/escpos-raster.ts`
- Modify: `apps/pappas-order-management/test/escpos-raster.test.ts`

**Interfaces:**

- Consumes: `captureRef(ref, { format: 'raw', result: 'base64', width })` on Android.
- Produces: `captureRawReceiptCandidate(ref, width): Promise<{ kind: 'raw-argb'; width: number; height: number; argb: Uint8Array }>`.

- [ ] **Step 1: Write failing raw parser tests**

```ts
test('parses an uncompressed Android raw capture with dimensions', () => {
  const candidate = parseRawCapture('2:1|/////wAAAP8=');
  assert.deepEqual(candidate, { kind: 'raw-argb', width: 2, height: 1, argb: Uint8Array.from([255, 255, 255, 255, 0, 0, 0, 255]) });
});

test('rejects raw capture data with a byte count different from width times height times four', () => {
  assert.throws(() => parseRawCapture('2:1|/w=='), /expected 8 bytes/i);
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- escpos-raster.test.js`

Expected: FAIL because the parser is private, missing validation, or unsupported by the test build.

- [ ] **Step 3: Implement explicit uncompressed candidate capture**

Export a parser with raw byte-length validation. Add `captureRawReceiptCandidate` that rejects outside Android and calls `captureRef` with `format: 'raw'`, `result: 'base64'`, and requested width. Do not modify `captureReceiptForPrinter` or `captureReceiptPreviewAndRaw`; they remain PNG production APIs. Do not add `zip-base64` in this task.

- [ ] **Step 4: Run parser and full unit tests**

Run: `pnpm --filter pappas-order-management test:unit -- escpos-raster.test.js`

Expected: PASS.

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/lib/printer-image.ts apps/pappas-order-management/lib/escpos-raster.ts apps/pappas-order-management/test/escpos-raster.test.ts apps/pappas-order-management/tsconfig.test.json
git commit -m "feat(print): add validated Android raw capture candidate"
```

### Task 4: Add a Default-Off, Non-Printing Comparison Diagnostic

**Files:**

- Modify: `apps/pappas-order-management/stores/printerAutomationStore.ts`
- Modify: `apps/pappas-order-management/providers/PrinterAutomationProvider.tsx`
- Modify: `apps/pappas-order-management/lib/print-queue.ts`
- Create: `apps/pappas-order-management/test/raw-tcp-diagnostic.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**

- Consumes: `captureRawReceiptCandidate`, `prepareEscPosImage`, and `compareEscPosPayloads`.
- Produces: persisted `rawTcpPerformanceDiagnosticEnabled: boolean` defaulting to `false` and journal entries identifying pass/fail without printing candidate data.

- [ ] **Step 1: Write failing safety tests**

```ts
test('raw TCP diagnostic is disabled by default', () => {
  assert.match(storeSource, /rawTcpPerformanceDiagnosticEnabled:\s*false/);
});

test('diagnostic comparison cannot replace the PNG image passed to escposPrintOrderImage', () => {
  assert.match(queueSource, /escposPrintOrderImage\(startedJob\.image/);
  assert.doesNotMatch(queueSource, /escposPrintOrderImage\([^)]*rawCandidate/);
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- raw-tcp-diagnostic.test.js`

Expected: FAIL because the setting and guarded comparison path are absent.

- [ ] **Step 3: Implement guarded diagnostic flow**

Add the default-off store setting and its setter through the existing print settings surface. In the provider, when enabled for Android raw-TCP, capture reference PNG and raw candidate after the same render settle; prepare both through Task 1, compare exact bytes, and journal capture/decode/resize/raster totals, dimensions, byte lengths, and first mismatch index. Always enqueue unchanged PNG `image`; catch every candidate error locally, journal it, and proceed with PNG.

- [ ] **Step 4: Run diagnostic and full unit tests**

Run: `pnpm --filter pappas-order-management test:unit -- raw-tcp-diagnostic.test.js`

Expected: PASS.

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/stores/printerAutomationStore.ts apps/pappas-order-management/providers/PrinterAutomationProvider.tsx apps/pappas-order-management/lib/print-queue.ts apps/pappas-order-management/test/raw-tcp-diagnostic.test.ts apps/pappas-order-management/tsconfig.test.json
git commit -m "feat(print): add guarded raw TCP comparison diagnostic"
```

### Task 5: Verify on Tablet and Decide Whether to Continue

**Files:**

- Modify: none unless a discrepancy is observed.

**Interfaces:**

- Consumes: diagnostic journal records from Task 4.
- Produces: a human-approved decision to retain PNG or start a separate plan for `zip-base64` raw validation.

- [ ] **Step 1: Enable diagnostic on the target Android tablet and print a representative long receipt**

Expected: printer receives PNG reference payload only; journal records capture, decode, resize, raster, total, byte sizes, and equality result.

- [ ] **Step 2: Compare physical receipt with a diagnostic-disabled PNG receipt**

Expected: output is legible and unchanged because both are sent through PNG.

- [ ] **Step 3: Report the observed baseline and diagnostic outcome**

Expected: report measured phase durations and equality. Do not enable raw production mode, add `zip-base64`, or claim improvement without explicit user approval after reviewing tablet evidence.
