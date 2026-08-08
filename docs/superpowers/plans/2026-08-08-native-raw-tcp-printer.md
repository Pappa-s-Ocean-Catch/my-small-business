# Native Raw-TCP Printer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Android/iOS native raw-TCP printing behind a persisted rollout gate while retaining JavaScript raster/send as the fallback.

**Architecture:** The local Expo module owns receipt-view capture, RGBA conversion, nearest-neighbour resize, the current ESC/POS bit-image sequence, and target-keyed socket sending. `escpos-printer.ts` alone chooses JS-only, native diagnostic, or native enabled operation for the `rawTcp` driver.

**Tech Stack:** Expo Modules API, Kotlin Bitmap/Socket, Swift Core Graphics/Network, TypeScript, Node test runner.

## Global Constraints

- Never return a full raw buffer to JavaScript from native code.
- Serialize only the same normalized host:port; distinct targets can print in parallel.
- Preserve current JS raw-TCP code as fallback; Epson SDK and simulator must not change.
- Persist `js-only` as the default. Diagnostic mode sends JS bytes only.
- Do not enable native by default until fixture and physical tablet evidence is recorded.

---

### Task 1: Lock the JavaScript compatibility oracle

**Files:**
- Create: `apps/pappas-order-management/test/escpos-raster-fixtures.test.ts`
- Modify: `apps/pappas-order-management/lib/escpos-raster.ts`

**Interfaces:** Produces deterministic `{ bytes, byteLength, width, height, sha256 }` fixture data from `prepareEscPosImage`; native tests consume the byte fixtures/digests.

- [ ] **Step 1: Write failing fixture tests**

```ts
test('alpha at 58 mm matches the locked JS ESC/POS fixture', async () => {
  const actual = await createEscPosRasterFixture(alphaRgba, 16, 3, 384);
  assert.equal(actual.sha256, 'replace-after-first-green-run');
});
```

Include five cases: black/white, alpha, long receipt, 384-dot 58 mm, and 576-dot 80 mm. Assert dimensions, byte length, and digest.

- [ ] **Step 2: Verify red**

Run: `pnpm --filter pappas-order-management test:unit -- escpos-raster-fixtures.test.js`

Expected: FAIL because `createEscPosRasterFixture` does not exist.

- [ ] **Step 3: Add the minimal fixture helper**

```ts
export async function createEscPosRasterFixture(rgba: Uint8Array, width: number, height: number, maxWidth: number) {
  const prepared = await prepareEscPosImage({ kind: 'raw-argb', width, height, argb: rgbaToArgb(rgba) }, maxWidth);
  return { bytes: prepared.bytes, byteLength: prepared.bytes.length, width: prepared.width, height: prepared.height, sha256: sha256Hex(prepared.bytes) };
}
```

Run once to record digest constants, replace placeholders, and rerun the fixture test.

- [ ] **Step 4: Verify green and commit**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

```bash
git add apps/pappas-order-management/lib/escpos-raster.ts apps/pappas-order-management/test/escpos-raster-fixtures.test.ts
git commit -m "test: lock ESC POS raster fixtures"
```

### Task 2: Complete Expo module contract and autolinking

**Files:**
- Modify: `libs/native-raw-tcp-printer/src/index.ts`
- Modify: `libs/native-raw-tcp-printer/package.json`
- Modify: `libs/native-raw-tcp-printer/expo-module.config.json`
- Create: `libs/native-raw-tcp-printer/app.plugin.js`
- Modify: `apps/pappas-order-management/app.config.js`
- Modify: `apps/pappas-order-management/package.json`

**Interfaces:** Produces `getNativeRawTcpPrinter(): NativeRawTcpPrinter | null`; `print` options include `viewTag`, `host`, `port`, `width`, `copies`, `operation`, and `timeoutMs`. Results include five timings, final dimensions, byte length, SHA-256, and `sent`.

- [ ] **Step 1: Write a failing safe-lookup test**

```ts
test('module lookup returns null when native code is unavailable', () => {
  assert.equal(getNativeRawTcpPrinter(() => { throw new Error('missing'); }), null);
});
```

- [ ] **Step 2: Verify red**

Run: `pnpm --filter pappas-order-management test:unit -- raw-tcp-native-settings.test.js`

Expected: FAIL with missing export.

- [ ] **Step 3: Implement types and safe lookup**

```ts
export type NativeRawTcpPrintErrorCode = 'INVALID_OPTIONS' | 'VIEW_NOT_FOUND' | 'CAPTURE_FAILED' | 'RASTER_FAILED' | 'CONNECTION_FAILED' | 'SEND_FAILED' | 'TIMEOUT';
export function getNativeRawTcpPrinter(loader = requireNativeModule) {
  try { return loader<NativeRawTcpPrinter>('NativeRawTcpPrinter'); } catch { return null; }
}
```

Keep the existing printer-permissions plugin authoritative for local-network permissions; module wiring must add no duplicate iOS permissions.

- [ ] **Step 4: Verify green and commit**

Run: `pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: PASS.

```bash
git add libs/native-raw-tcp-printer apps/pappas-order-management/package.json apps/pappas-order-management/app.config.js pnpm-lock.yaml
git commit -m "feat: scaffold native raw TCP printer module"
```

### Task 3: Persist platform rollout modes

**Files:**
- Create: `apps/pappas-order-management/lib/raw-tcp-native-settings.ts`
- Modify: `apps/pappas-order-management/lib/settings.ts`
- Create: `apps/pappas-order-management/test/raw-tcp-native-settings.test.ts`

**Interfaces:** Produces `RawTcpNativeMode = 'js-only' | 'native-diagnostic' | 'native-enabled'`, `normalizeRawTcpNativeMode`, and `getRawTcpNativeMode(settings, platform)`.

- [ ] **Step 1: Write failing normalization tests**

```ts
test('legacy stored settings default to JS-only', () => assert.equal(normalizeRawTcpNativeMode(undefined), 'js-only'));
test('only rollout values survive normalization', () => assert.equal(normalizeRawTcpNativeMode('native-diagnostic'), 'native-diagnostic'));
```

- [ ] **Step 2: Verify red**

Run: `pnpm --filter pappas-order-management test:unit -- raw-tcp-native-settings.test.js`

Expected: FAIL because the helper is missing.

- [ ] **Step 3: Add settings fields and normalization**

```ts
export function normalizeRawTcpNativeMode(value: unknown): RawTcpNativeMode {
  return value === 'native-diagnostic' || value === 'native-enabled' ? value : 'js-only';
}
```

Add `rawTcpNativeModeAndroid` and `rawTcpNativeModeIos` to `AppSettings` and its persisted normalization, both defaulting to `js-only`.

- [ ] **Step 4: Verify green and commit**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

```bash
git add apps/pappas-order-management/lib/raw-tcp-native-settings.ts apps/pappas-order-management/lib/settings.ts apps/pappas-order-management/test/raw-tcp-native-settings.test.ts
git commit -m "feat: add native raw TCP rollout settings"
```

### Task 4: Implement Android native pipeline

**Files:**
- Modify: `libs/native-raw-tcp-printer/android/src/main/java/com/mysmallbusiness/nativerawtcpprinter/NativeRawTcpPrinterModule.kt`
- Create: `libs/native-raw-tcp-printer/android/src/test/java/com/mysmallbusiness/nativerawtcpprinter/EscPosRasterFixtureTest.kt`

**Interfaces:** Consumes Tasks 1–2 and produces the same result/error contract without exposing bytes.

- [ ] **Step 1: Write failing Android fixture test**

```kotlin
@Test fun alpha58mm_matchesJavaScriptFixture() {
  assertEquals(alpha58Digest, EscPosRaster.sha256(EscPosRaster.render(alphaPixels, 16, 3, 384)))
}
```

- [ ] **Step 2: Verify red**

Run: `cd libs/native-raw-tcp-printer/android && ./gradlew testDebugUnitTest --tests '*EscPosRasterFixtureTest'`

Expected: FAIL because `EscPosRaster` is absent.

- [ ] **Step 3: Implement capture, raster, diagnostic, and queue**

```kotlin
val bitmap = withContext(Dispatchers.Main) { captureView(options.viewTag) }
val rgba = bitmapToRgba(bitmap)
val resized = resizeNearestRgba(rgba, bitmap.width, bitmap.height, alignToEight(options.width))
val bytes = encodeEscPos(resized)
if (options.operation == "print") targetQueues.run(options.host + ":" + options.port) { sendSocket(options, bytes) }
```

Capture on the UI thread; use PixelCopy with a view-draw fallback, normalize to RGBA, preserve the JS luminance (0.299/0.587/0.114) and alpha threshold behavior, emit identical ESC @, alignment, ESC *, feed, and cut bytes. Use Socket.connect, write, flush, and timeouts. Map failures to Task 2 codes.

- [ ] **Step 4: Add all five fixture tests and verify green**

Run: `cd libs/native-raw-tcp-printer/android && ./gradlew testDebugUnitTest`

Expected: PASS for black/white, alpha, long receipt, 58 mm, and 80 mm.

- [ ] **Step 5: Commit**

```bash
git add libs/native-raw-tcp-printer/android
git commit -m "feat(android): add native raw TCP raster printing"
```

### Task 5: Implement iOS native pipeline

**Files:**
- Modify: `libs/native-raw-tcp-printer/ios/NativeRawTcpPrinterModule.swift`
- Create: `libs/native-raw-tcp-printer/ios/NativeRawTcpPrinterModuleTests.swift`

**Interfaces:** Consumes Tasks 1–2 and produces Android-equivalent result fields and error codes.

- [ ] **Step 1: Write failing iOS fixture test**

```swift
func testAlpha58mmMatchesJavaScriptFixture() throws {
  XCTAssertEqual(EscPosRaster.sha256(EscPosRaster.render(alphaPixels, width: 16, height: 3, maxWidth: 384)), alpha58Digest)
}
```

- [ ] **Step 2: Verify red**

Run: `xcodebuild test -workspace apps/pappas-order-management/ios/PappasOrderManagement.xcworkspace -scheme PappasOrderManagement -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:NativeRawTcpPrinterModuleTests`

Expected: FAIL while the raster implementation is absent.

- [ ] **Step 3: Implement equivalent Swift pipeline**

```swift
let image = try await captureView(tag: options.viewTag)
let resized = resizeNearest(try image.rgbaPixels(), maxWidth: alignToEight(options.width))
let bytes = escPosBytes(resized)
if options.operation == .print { try await queues.run(key: options.host + ":" + String(options.port)) { try await send(bytes, options) } }
```

Capture on the main actor; use a Core Graphics RGBA bitmap context, the same raster loop as Android/JS, and NWConnection with connection/write timeouts. Hold ESC/POS bytes in Swift only and return digest/metadata.

- [ ] **Step 4: Add all five fixture tests and verify green**

Run: `xcodebuild test -workspace apps/pappas-order-management/ios/PappasOrderManagement.xcworkspace -scheme PappasOrderManagement -destination 'platform=iOS Simulator,name=iPhone 16'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/native-raw-tcp-printer/ios
git commit -m "feat(ios): add native raw TCP raster printing"
```

### Task 6: Integrate raw-TCP modes and retain JS fallback

**Files:**
- Modify: `apps/pappas-order-management/lib/escpos-printer.ts`
- Modify: `apps/pappas-order-management/lib/printer-image.ts`
- Modify: `apps/pappas-order-management/test/raw-tcp-native-settings.test.ts`

**Interfaces:** Consumes Tasks 2–3. Uses existing `buildRawImagePrintBytes` and `withRawTcpPrinter` unchanged for all JS sends.

- [ ] **Step 1: Write a failing diagnostic dispatch test**

```ts
test('native diagnostics send JavaScript bytes only', async () => {
  await printRawTcp({ mode: 'native-diagnostic', nativeModule, jsSender });
  assert.equal(nativeModule.options.operation, 'diagnostic');
  assert.equal(jsSender.calls, 1);
});
```

Also test absent-module and native-error fallback call the JS sender exactly once.

- [ ] **Step 2: Verify red**

Run: `pnpm --filter pappas-order-management test:unit -- raw-tcp-native-settings.test.js`

Expected: FAIL because mode dispatch is absent.

- [ ] **Step 3: Implement raw-TCP-only mode dispatch**

```ts
if (mode === 'native-enabled' && native) {
  try { await native.print({ ...nativeOptions, operation: 'print' }); return; }
  catch (error) { logNativeFallback(error); }
}
if (mode === 'native-diagnostic' && native) {
  void native.print({ ...nativeOptions, operation: 'diagnostic' }).then(logDiagnostic).catch(logDiagnosticFailure);
}
await sendJavaScriptRawTcpBytes();
```

Pass a React view tag only while a native-capturable receipt reference is available. Otherwise log a diagnostic skip/fallback and use the existing JS path. Do not alter non-raw driver branches.

- [ ] **Step 4: Verify green and commit**

Run: `pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: PASS.

```bash
git add apps/pappas-order-management/lib/escpos-printer.ts apps/pappas-order-management/lib/printer-image.ts apps/pappas-order-management/test/raw-tcp-native-settings.test.ts
git commit -m "feat: gate raw TCP printing behind native rollout"
```

### Task 7: Prebuild and record release evidence

**Files:**
- Create: `docs/printing/native-raw-tcp-verification.md`

**Interfaces:** Produces the permanent Android/iOS timing and visual-verification record. It does not change default rollout modes.

- [ ] **Step 1: Create the verification template**

```markdown
| Platform | Build | Mode | Fixture result | Receipt visual result | Capture | Resize | Raster | Send | Total | Approved by |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
```

- [ ] **Step 2: Prebuild both native projects**

Run: `pnpm --filter pappas-order-management exec expo prebuild --platform android && pnpm --filter pappas-order-management exec expo prebuild --platform ios`

Expected: successful autolinking for `NativeRawTcpPrinter`.

- [ ] **Step 3: Run automated verification**

Run: `pnpm --filter pappas-order-management test:unit && cd apps/pappas-order-management/android && ./gradlew testDebugUnitTest`

Expected: PASS. Run Task 5’s `xcodebuild test` when the iOS simulator/toolchain is available.

- [ ] **Step 4: Perform physical verification in diagnostic mode**

Set each platform to `native-diagnostic`, print every fixture, and record returned digest/timings and the single JS receipt. Keep any unverified platform at `js-only`.

- [ ] **Step 5: Enable only verified platforms and commit evidence**

Set a verified platform to `native-enabled`, reprint each fixture, and record one correct receipt per job with no fallback. Leave code defaults at `js-only`.

```bash
git add docs/printing/native-raw-tcp-verification.md
git commit -m "docs: record native raw TCP printer verification"
```

## Plan self-review

- Coverage: Tasks 1, 4, and 5 establish raster equivalence; Tasks 2, 4, and 5 implement native contract/capture/send/queue/errors; Task 3 persists safe defaults; Task 6 limits integration to raw-TCP and preserves fallback; Task 7 covers prebuild and hardware gates.
- Type consistency: Task 2 defines the native options/results used by Tasks 4–6; Task 3 defines modes consumed by Task 6.
- Scope: No Epson SDK code or simulator behavior is touched; native default promotion remains a human-verified deployment decision.

