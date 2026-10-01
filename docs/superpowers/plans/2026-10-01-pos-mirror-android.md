# POS Mirror Android Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native Android application (`apps/pos-mirror-android`) in Kotlin targeting Android 5.0+ (API 21+) that reproduces `apps/pos-mirror` like-for-like and installs on the Citaq H10-3 POS terminal.

**Architecture:** Pure Kotlin application using Android Views + Material Components for high-performance 1024x768 landscape rendering, OkHttp 4.12 for Supabase Auth REST and Phoenix WebSocket Realtime engine, and SharedPreferences for persistence.

**Tech Stack:** Kotlin 1.9+, Android SDK (minSdk 21, targetSdk 34), Material Components 1.9.0, OkHttp 4.12.0, Gson 2.10.1, Kotlin Coroutines 1.7.3.

**Spec:** [docs/superpowers/specs/2026-10-01-pos-mirror-android-design.md](file:///Users/truongnguyen/source/my-small-business/docs/superpowers/specs/2026-10-01-pos-mirror-android-design.md)

## Global Constraints
- Target minSdk: 21 (Android 5.0 Lollipop)
- Target device: Citaq H10-3 (1024x768 landscape, Rockchip RK3368, 2GB RAM)
- Standalone APK size limit: < 8MB
- Package name: `com.pappas.posmirror`
- Brand colors: Primary `#E11D48`, Background `#FFF1F2`, Surface `#FFFFFF`, Text `#881337`, Accent `#2563EB`

---

## Tasks

- [x] **Task 1: Scaffold `apps/pos-mirror-android` Gradle Project**
  - Create directory structure: `apps/pos-mirror-android/{app/src/main/java/com/pappas/posmirror,app/src/main/res}`
  - Create `settings.gradle` and root `build.gradle`
  - Create `app/build.gradle` with `minSdkVersion = 21`, `targetSdkVersion = 34`, dependencies (Material, supabase-kt, OkHttp, Gson, Coroutines)
  - Verify Gradle configuration compiles cleanly with `./gradlew tasks`

- [x] **Task 2: Data Models & Unit Tests**
  - Implement `MirrorOrderSnapshot`, `MirrorOrderLine`, `Customization`, `CustomerQueueEntry`, `MirrorSettings` in `com.pappas.posmirror.data.model`
  - Implement parser/converter for Supabase `pos_mirror_state` payload
  - Write JUnit tests for JSON parsing and snapshot reconciliation
  - Verify all unit tests pass

- [x] **Task 3: Supabase Auth & Settings Repository**
  - Implement `SettingsRepository` backed by `SharedPreferences` (stores `registerId`, `idleMode`, `idleImageUri`, `accessToken`)
  - Implement `SupabaseClientProvider` and `SupabaseRepository` using official `io.github.jan-tennert.supabase` SDK (Auth, Postgrest, Realtime)
  - Role permissions check (`admin` / `staff`)

- [x] **Task 4: Supabase Realtime WebSocket Engine**
  - Integrated `supabase-kt` 3.0.2 `realtime-kt` with `postgresChangeFlow` on `pos_mirror_state` and `order_sync_state`
  - Core library desugaring enabled for Android 5.0 (minSdk 21) compatibility

- [x] **Task 5: UI & Brand Themes (Landscape 1024x768)**
  - Added colors, styles, dimens, and drawable assets matching Pappas brand
  - Built `LoginActivity` with Material outlined inputs, sign in button, and error banner
  - Built `SettingsActivity` with live register selector from Supabase, idle mode radio group, and sign out
  - Built `DisplayActivity` with 2-column active cart layout (Left: QTY/ITEM/EACH/TOTAL RecyclerView; Right: TOTAL TO PAY, discount notice, PREPPING queue count, secret 5-tap unlock)
  - Built Idle Artwork display and Customer Queue two-column board
  - Added fullscreen immersive sticky mode and `FLAG_KEEP_SCREEN_ON`

- [x] **Task 6: Build APK & Deploy to Citaq H10-3 via ADB**
  - Ran `./gradlew assembleRelease` generating `app-release.apk`
  - Verified APK `minSdkVersion` is 21 using `aapt dump badging`
  - Installed onto Citaq device via ADB: `adb -s 192.168.4.68:5555 install -r app-release.apk`
  - Launched app on device and confirmed live operation on the Citaq H10-3 terminal
