# HT813 Caller ID Listener Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in Android HT813 SIP/UDP caller-ID listener that surfaces raw incoming caller numbers without interrupting POS workflows.

**Architecture:** A local Expo module owns the Android UDP socket, pure SIP parsing, Call-ID deduplication, and native events. The POS app owns device-local configuration, session-aware lifecycle reconciliation, global status, and a touch-through caller card.

**Tech Stack:** Expo Modules Core 3, Kotlin, Android DatagramSocket, React Native 0.81, React Native Paper, TypeScript, Zustand, AsyncStorage, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-04-ht813-caller-id-listener-design.md`

## Global Constraints

- Android-only native behavior; web, Expo Go, and stale clients must not crash.
- Bind UDP `0.0.0.0:<port>`; default 5060; validate port `1..65535`.
- Keep identity raw: no phone normalization, customer lookup, persistence, Supabase, HTTP, or POS business logic in native code.
- Use one background socket/worker only; stop must close the socket and be idempotent.
- Settings are device-local, disabled by default, with display duration default 8 and range `2..60`.
- The caller presentation must not block screen touches; do not use a React Native `Modal`.
- V1 has no foreground service. A fresh Android build/install is needed for native verification; OTA is insufficient.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `libs/caller-id-listener/{package.json,expo-module.config.json,app.plugin.js}` | Local Expo package, autolinking, idempotent INTERNET permission. |
| `libs/caller-id-listener/src/index.ts` | Typed safe native module adapter and event contracts. |
| `libs/caller-id-listener/android/.../SipInviteParser.kt` | Pure INVITE/header/identity parser. |
| `libs/caller-id-listener/android/.../CallerIdListenerModule.kt` | Socket, worker, bounded deduplication, events. |
| `libs/caller-id-listener/android/.../SipInviteParserTest.kt` | Native parser tests. |
| `apps/pappas-order-management/lib/caller-id-settings.ts` | Pure persisted-setting normalization. |
| `apps/pappas-order-management/lib/caller-id-listener.ts` | Testable app lifecycle reconciliation. |
| `apps/pappas-order-management/providers/CallerIdListenerProvider.tsx` | Global subscriptions, status/card state, cleanup. |
| `apps/pappas-order-management/components/{CallerIdStatusChip,IncomingCallerCard}.tsx` | Global status and touch-through UI. |
| `apps/pappas-order-management/lib/settings.ts` | Extend AppSettings persistence. |
| `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx` | Caller-ID settings tile and controls. |
| `apps/pappas-order-management/app/_layout.tsx` | Mount provider inside app-settings/authenticated shell. |
| `apps/pappas-order-management/test/caller-id-*.test.ts` | Settings, lifecycle, timer tests. |

### Task 1: Create the native SIP INVITE parser

**Files:**
- Create: `libs/caller-id-listener/package.json`
- Create: `libs/caller-id-listener/expo-module.config.json`
- Create: `libs/caller-id-listener/android/build.gradle`
- Create: `libs/caller-id-listener/android/src/main/java/com/mysmallbusiness/calleridlistener/SipInviteParser.kt`
- Create: `libs/caller-id-listener/android/src/test/java/com/mysmallbusiness/calleridlistener/SipInviteParserTest.kt`
- Modify: `apps/pappas-order-management/package.json`

**Interfaces:**
- Produces: `data class ParsedInvite(val phoneNumber: String, val callId: String?)`.
- Produces: `SipInviteParser.parse(payload: String): ParsedInvite?`.

- [ ] **Step 1: Write failing parser tests**

```kotlin
@Test fun `uses asserted identity before remote party and from`() {
  val invite = """INVITE sip:1000@host SIP/2.0
    P-Asserted-Identity: <sip:+61412345678@host>
    Remote-Party-ID: <sip:0399999999@host>
    From: <sip:0411111111@host>
    Call-ID: abc123@host""".trimIndent()
  assertEquals(ParsedInvite("+61412345678", "abc123@host"), SipInviteParser.parse(invite))
}
@Test fun `preserves From mobile and ignores invalid packets`() {
  assertEquals("0412345678", SipInviteParser.parse("INVITE sip:1000@host SIP/2.0\nFrom: <sip:0412345678@host>")?.phoneNumber)
  assertNull(SipInviteParser.parse("OPTIONS sip:1000@host SIP/2.0"))
  assertNull(SipInviteParser.parse("INVITE sip:1000@host SIP/2.0\nFrom: Anonymous <sip:anonymous@host>"))
}
```

- [ ] **Step 2: Run the parser test and observe RED**

Run: `pnpm --filter pappas-order-management exec expo prebuild --platform android && cd apps/pappas-order-management/android && ./gradlew :caller-id-listener:testDebugUnitTest`

Expected: FAIL because parser source does not exist.

- [ ] **Step 3: Implement the minimal parser**

```kotlin
data class ParsedInvite(val phoneNumber: String, val callId: String?)
object SipInviteParser {
  fun parse(payload: String): ParsedInvite? {
    // Require first line to start INVITE, unfold continuations, lowercase header names.
    // Select first valid SIP user from P-Asserted-Identity, Remote-Party-ID, then From.
  }
}
```

Implement header unfolding; extract the SIP user before `@`, `;`, whitespace, or `>`; reject blank, anonymous, private, and unknown case-insensitively. Preserve valid phone text exactly. Read trimmed optional Call-ID.

- [ ] **Step 4: Run parser tests and observe GREEN**

Run: `cd apps/pappas-order-management/android && ./gradlew :caller-id-listener:testDebugUnitTest`

Expected: PASS for From local mobile, +61, priority, folded headers, anonymous, malformed, and non-INVITE cases.

- [ ] **Step 5: Commit**

```bash
git add libs/caller-id-listener apps/pappas-order-management/package.json
git commit -m "feat: parse HT813 SIP caller identities"
```

### Task 2: Add the Expo UDP listener module and safe JS adapter

**Files:**
- Create: `libs/caller-id-listener/app.plugin.js`
- Create: `libs/caller-id-listener/src/index.ts`
- Create: `libs/caller-id-listener/android/src/main/java/com/mysmallbusiness/calleridlistener/CallerIdListenerModule.kt`
- Modify: `apps/pappas-order-management/app.config.js`

**Interfaces:**
- Consumes: `SipInviteParser.parse`.
- Produces: `CallerIdIncomingCall`, `CallerIdListenerStatus`, and `getNativeCallerIdListener(): NativeCallerIdListener | null`.
- Native methods: `start(port: number)`, `stop()`, `isRunning()`; events `CallerIdIncomingCall`, `CallerIdListenerStatus`.

- [ ] **Step 1: Write failing adapter tests**

```ts
test('does not crash when native module is unavailable', () => {
  assert.equal(getNativeCallerIdListener(() => { throw new Error('missing'); }), null);
});
test('rejects an invalid port before native start', async () => {
  await assert.rejects(() => startCallerIdListener(fakeNative, 0), /between 1 and 65535/);
});
```

- [ ] **Step 2: Run the test and observe RED**

Run: `pnpm --filter pappas-order-management test:unit -- caller-id-listener.test.ts`

Expected: FAIL because adapter exports do not exist.

- [ ] **Step 3: Implement module and adapter**

Use the existing local Expo module conventions. Register namespace `com.mysmallbusiness.calleridlistener`, package `@my-small-business/caller-id-listener`, and its app plugin after the raw-TCP plugin. The plugin must idempotently add only INTERNET.

In Kotlin, guard mutable state with one lock. On IO dispatcher bind `DatagramSocket(null)` to `0.0.0.0:port`, then receive bounded datagrams until closed. Emit starting/listening/stopped/error statuses. Parse only each packet's actual UTF-8 byte count. Deduplicate non-empty Call-IDs for five minutes, prune on input, cap at 256 records, and emit only the first INVITE event. Closing during stop exits silently; unexpected errors emit status and release references. Add `OnDestroy { stop() }`.

In TypeScript, guard `requireNativeModule`, validate ports, expose typed event subscription helpers around `NativeEventEmitter`, and retain no POS behavior.

- [ ] **Step 4: Run code/module checks and observe GREEN**

Run: `pnpm --filter pappas-order-management test:unit -- caller-id-listener.test.ts && pnpm --filter pappas-order-management exec expo prebuild --platform android && cd apps/pappas-order-management/android && ./gradlew :caller-id-listener:testDebugUnitTest`

Expected: PASS; prebuild recognizes CallerIdListener and adapter safely handles no module.

- [ ] **Step 5: Commit**

```bash
git add libs/caller-id-listener apps/pappas-order-management/package.json apps/pappas-order-management/app.config.js
git commit -m "feat: add Android caller ID listener module"
```

### Task 3: Persist caller-ID settings

**Files:**
- Create: `apps/pappas-order-management/lib/caller-id-settings.ts`
- Create: `apps/pappas-order-management/test/caller-id-settings.test.ts`
- Modify: `apps/pappas-order-management/lib/settings.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Produces: `normalizeCallerIdSettings(value): { callerIdEnabled: boolean; callerIdPort: number; callerIdDisplaySeconds: number }`.
- Consumed by load/save functions and provider.

- [ ] **Step 1: Write failing normalization tests**

```ts
test('uses opt-in defaults', () => {
  assert.deepEqual(normalizeCallerIdSettings({}), { callerIdEnabled: false, callerIdPort: 5060, callerIdDisplaySeconds: 8 });
});
test('clamps settings bounds', () => {
  assert.deepEqual(normalizeCallerIdSettings({ callerIdEnabled: true, callerIdPort: 99999, callerIdDisplaySeconds: 1 }),
    { callerIdEnabled: true, callerIdPort: 65535, callerIdDisplaySeconds: 2 });
});
```

- [ ] **Step 2: Run the focused test and observe RED**

Run: `pnpm --filter pappas-order-management test:unit -- caller-id-settings.test.ts`

Expected: FAIL because normalizer is absent.

- [ ] **Step 3: Implement the settings slice**

Add `callerIdEnabled`, `callerIdPort`, and `callerIdDisplaySeconds` to `AppSettings` and default settings. Normalize in both load and save via the new helper—no duplicate parsing. Validate by integer truncation and clamping: port 1..65535, duration 2..60. Include sources/tests in `tsconfig.test.json`.

- [ ] **Step 4: Run the focused test and observe GREEN**

Run: `pnpm --filter pappas-order-management test:unit -- caller-id-settings.test.ts`

Expected: PASS for absent, invalid, min/max, and valid values.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/lib/caller-id-settings.ts apps/pappas-order-management/lib/settings.ts apps/pappas-order-management/test/caller-id-settings.test.ts apps/pappas-order-management/tsconfig.test.json
git commit -m "feat: persist caller ID listener settings"
```

### Task 4: Reconcile lifecycle and display non-blocking caller UI

**Files:**
- Create: `apps/pappas-order-management/lib/caller-id-listener.ts`
- Create: `apps/pappas-order-management/providers/CallerIdListenerProvider.tsx`
- Create: `apps/pappas-order-management/components/CallerIdStatusChip.tsx`
- Create: `apps/pappas-order-management/components/IncomingCallerCard.tsx`
- Modify: `apps/pappas-order-management/app/_layout.tsx`
- Modify: `apps/pappas-order-management/test/caller-id-listener.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Consumes: native adapter and normalized settings.
- Produces: `reconcileCallerIdListener(previous, next, client)`, UI statuses `off | starting | listening | error`, and card props `{ phoneNumber, onDismiss }`.

- [ ] **Step 1: Write failing lifecycle/card tests**

```ts
test('starts once when authenticated settings enable caller ID', async () => {
  await reconcileCallerIdListener({ authenticated: false, enabled: false, port: 5060 }, { authenticated: true, enabled: true, port: 5060 }, fake);
  assert.deepEqual(fake.calls, [['start', 5060]]);
});
test('rebinds once when enabled port changes', async () => {
  await reconcileCallerIdListener({ authenticated: true, enabled: true, port: 5060 }, { authenticated: true, enabled: true, port: 5061 }, fake);
  assert.deepEqual(fake.calls, [['stop'], ['start', 5061]]);
});
test('new caller replaces card and resets its timer', () => {
  assert.equal(receiveCaller({ phoneNumber: '+61412345678' }, 8000, receiveCaller({ phoneNumber: '0412345678' }, 8000)).phoneNumber, '+61412345678');
});
```

- [ ] **Step 2: Run the test and observe RED**

Run: `pnpm --filter pappas-order-management test:unit -- caller-id-listener.test.ts`

Expected: FAIL because controller/card-state functions are absent.

- [ ] **Step 3: Implement provider and overlay**

The pure controller starts only when the session is authenticated and settings enable it; it stops on disable, logout, unmount, and error, and executes exactly one stop/start for an enabled port change. It does not query Supabase or navigate.

Provider waits for app-settings hydration, subscribes once to native caller/status events, clears subscriptions/timers on cleanup, and owns the latest card/status. Mount it within `AppSettingsProvider` and pass `authenticatedStaffAccess` from root layout. Cards use a normalized timeout; replacement clears old timeout then starts a new one.

Status chip must use `pointerEvents="none"`. Overlay container must use `pointerEvents="box-none"`; only the card and Close action use `pointerEvents="auto"`. Do not use a Modal or Portal.

- [ ] **Step 4: Run tests and observe GREEN**

Run: `pnpm --filter pappas-order-management test:unit -- caller-id-listener.test.ts caller-id-settings.test.ts`

Expected: PASS for idempotency, rebind, stop states, unavailable native module, card close, and replacement/timer behavior.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/lib/caller-id-listener.ts apps/pappas-order-management/providers/CallerIdListenerProvider.tsx apps/pappas-order-management/components/CallerIdStatusChip.tsx apps/pappas-order-management/components/IncomingCallerCard.tsx apps/pappas-order-management/app/_layout.tsx apps/pappas-order-management/test/caller-id-listener.test.ts apps/pappas-order-management/tsconfig.test.json
git commit -m "feat: show non-blocking incoming caller cards"
```

### Task 5: Add Settings UI and run Android acceptance checks

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`
- Modify: `apps/pappas-order-management/test/caller-id-settings.test.ts`

**Interfaces:**
- Consumes: AppSettings fields and provider status.
- Produces: saved enable, port, and display-duration values; provider, not screen, performs lifecycle changes.

- [ ] **Step 1: Write a failing saved-configuration test**

```ts
test('retains valid enabled configuration', () => {
  assert.deepEqual(normalizeCallerIdSettings({ callerIdEnabled: true, callerIdPort: 5062, callerIdDisplaySeconds: 12 }),
    { callerIdEnabled: true, callerIdPort: 5062, callerIdDisplaySeconds: 12 });
});
```

- [ ] **Step 2: Run test and observe RED**

Run: `pnpm --filter pappas-order-management test:unit -- caller-id-settings.test.ts`

Expected: FAIL until final screen save state passes all fields through.

- [ ] **Step 3: Implement Settings tile and configuration panel**

Add `callerId` to settings dialog type/title. Synchronize local enable, port-text, and duration-text state from current settings. Add Register tile titled **Caller ID listener**; summary is Disabled, Configured for UDP :port, or live provider status. Its panel has enable switch, numeric UDP port input, numeric caller-card seconds input, configured range helper text, and live status/error explanation. Extend the existing assembled `handleSave` settings object. The screen must never invoke native start/stop directly.

- [ ] **Step 4: Run focused and Android build verification**

Run: `pnpm --filter pappas-order-management test:unit -- caller-id-settings.test.ts caller-id-listener.test.ts && pnpm --filter pappas-order-management exec expo prebuild --platform android && cd apps/pappas-order-management/android && ./gradlew assembleDebug`

Expected: PASS and debug APK includes CallerIdListener. If full test suite hits its known unrelated printer TypeScript baseline, report focused pass and that separate boundary.

- [ ] **Step 5: Perform LAN acceptance verification**

Install the fresh APK. Enable listener and verify Listening :5060. Send one SIP INVITE with a known Call-ID and raw number; confirm one touch-through card. Retransmit that Call-ID; confirm no duplicate. Send a distinct Call-ID; confirm card replacement. Disable listener; confirm Off and released port. Repeat against real HT813 with its destination set to the tablet’s reserved LAN IP.

- [ ] **Step 6: Commit**

```bash
git add apps/pappas-order-management/app/'(drawer)'/'(tabs)'/settings.tsx apps/pappas-order-management/test/caller-id-settings.test.ts
git commit -m "feat: configure HT813 caller ID listening"
```
