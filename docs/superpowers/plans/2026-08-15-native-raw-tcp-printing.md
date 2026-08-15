# Native Raw TCP Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the JavaScript Raw TCP image/raster pipeline and make native printing observable in the journal without changing Epson or simulator printing.

**Architecture:** Raw TCP print jobs carry only a native receipt-view tag and capture quality. The platform module captures, scales, rasterizes, and sends that view once. The app logs a normalized dispatch result for both Raw TCP and Epson jobs, with native phase measurements available for Raw TCP.

**Tech Stack:** Expo/React Native, TypeScript, Expo modules Kotlin/Swift, Zustand, Node test runner.

## Global Constraints

- Modify the current main working tree; do not commit.
- Raw TCP on Android/iOS must have no JavaScript/base64/raster fallback.
- Preserve Epson SDK and simulator image printing.
- Journal every physical print with quality, requested print width, capture scale, and duration; include native dimensions, byte count, and phases for Raw TCP.

---

### Task 1: Define native-only Raw TCP payload and result contracts

**Files:**
- Modify: `apps/pappas-order-management/lib/printer-image.ts`
- Modify: `apps/pappas-order-management/lib/raw-tcp-native.ts`
- Modify: `apps/pappas-order-management/lib/escpos-printer.ts`
- Test: `apps/pappas-order-management/test/raw-tcp-native-settings.test.ts`

**Interfaces:**
- Produces `PrinterImageSource` with a `native-view` variant containing `nativeViewTag`, `captureScale`, `previewUri`, and requested quality.
- Produces `escposPrintOrderImage(...): Promise<PrintDispatchMetrics>` for physical printer journal logging.

- [ ] **Step 1: Write failing tests** asserting the legacy rollout setting API is absent and the native Raw TCP source carries `captureScale` rather than PNG/base64 payload data.
- [ ] **Step 2: Run the focused test** with `pnpm --filter pappas-order-management test:unit` and confirm the assertions fail against the legacy source.
- [ ] **Step 3: Implement the minimal contract**: return a native-view payload for Raw TCP and make the native module result include capture/raster/send dimensions and timings.
- [ ] **Step 4: Run the focused test** and confirm it passes.

### Task 2: Replace platform Raw TCP capture/raster operations

**Files:**
- Modify: `libs/native-raw-tcp-printer/android/src/main/java/com/mysmallbusiness/nativerawtcpprinter/NativeRawTcpPrinterModule.kt`
- Modify: `libs/native-raw-tcp-printer/ios/NativeRawTcpPrinterModule.swift`
- Test: `apps/pappas-order-management/test/image-only-printing.test.ts`

**Interfaces:**
- Consumes native `viewTag`, `width`, `captureScale`, and print connection options.
- Produces a single native capture at the selected quality before native resize/raster/send.

- [ ] **Step 1: Write failing source-contract tests** that forbid Raw TCP base64/raw comparison capture and require `captureScale` to be passed to both platform modules.
- [ ] **Step 2: Run the focused test** and confirm it fails because the old JS comparison/capture path remains.
- [ ] **Step 3: Implement native scaled view capture** in Kotlin and Swift, preserving requested paper-dot output width and per-printer serialization.
- [ ] **Step 4: Run the focused test** and confirm it passes.

### Task 3: Remove rollout configuration and journal print quality for both drivers

**Files:**
- Modify: `apps/pappas-order-management/lib/settings.ts`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`
- Modify: `apps/pappas-order-management/lib/print-queue.ts`
- Modify: `apps/pappas-order-management/providers/PrinterAutomationProvider.tsx`
- Test: `apps/pappas-order-management/test/image-only-printing.test.ts`

**Interfaces:**
- Consumes a print job’s actual capture metadata and `PrintDispatchMetrics`.
- Produces journal details for Epson and Raw TCP jobs with quality, scale, requested width, and duration; Raw TCP adds native capture/raster/output diagnostics.

- [ ] **Step 1: Write failing tests** proving settings no longer render or store a Raw TCP rollout mode and that queued print logs include quality fields.
- [ ] **Step 2: Run the focused test** and confirm it fails.
- [ ] **Step 3: Remove rollout fields/UI and add normalized journal details** at the print queue boundary, with quality metadata explicitly passed from all receipt capture call sites.
- [ ] **Step 4: Run the focused test** and confirm it passes.

### Task 4: Remove obsolete JS Raw TCP raster code and verify regression safety

**Files:**
- Delete: `apps/pappas-order-management/lib/escpos-raster.ts`
- Delete: `apps/pappas-order-management/lib/raw-tcp-native-settings.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`
- Modify: `apps/pappas-order-management/test/escpos-raster.test.ts`
- Modify: `apps/pappas-order-management/test/escpos-raster-fixtures.test.ts`
- Modify: `apps/pappas-order-management/test/raw-tcp-native-settings.test.ts`

**Interfaces:**
- Removes all app-side Raw TCP raster and rollout APIs.
- Keeps only native Raw TCP transport and Epson/simulator image transports.

- [ ] **Step 1: Update tests** to remove legacy raster-only coverage and retain native transport/quality contract coverage.
- [ ] **Step 2: Run the unit suite** and confirm failures identify remaining stale imports or source references.
- [ ] **Step 3: Remove obsolete implementation files and test configuration entries.**
- [ ] **Step 4: Run `pnpm --filter pappas-order-management test:unit` and `pnpm --filter pappas-order-management exec tsc --noEmit`** and confirm both complete successfully.
