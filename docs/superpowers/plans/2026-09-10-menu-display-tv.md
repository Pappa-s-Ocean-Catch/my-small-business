# Menu Display TV Implementation Plan

**Goal:** Deliver the approved offline menu display MVP for Google TV.
**Architecture:** Standalone native Activity with private image repository,
foreground LAN HTTP upload listener and bundled responsive upload page.
**Tech Stack:** Kotlin, Android SDK 36 / min SDK 26, Gradle, ZXing, JUnit.
**Spec:** `docs/superpowers/specs/2026-09-10-menu-display-tv-design.md`

## Constraints
- Confine changes to new app and these documents; preserve existing staged work.
- No cloud, POS dependencies, boot takeover or release publishing.
- Fit entire image; keep screen awake only while displaying.

## Execution
1. Configure standalone Gradle project and TV manifest/resources. Write tests
   for playlist reconciliation, bounded upload streaming and HTTP authentication.
   Run `./gradlew :app:testDebugUnitTest` and verify missing behavior fails.
2. Implement `Playlist.kt`, `LocalHttpServer.kt`, `ImageStore.kt`: reconcile
   missing IDs preserving order, limit incoming bodies, authenticate before
   reading uploads, persist catalog with AtomicFile and bound bitmap decoding.
3. Implement `MainActivity.kt`: focusable library, image actions, playlist editor,
   interval selection, fullscreen playback, lifecycle listener and wake flag.
   Bundle browser upload HTML/CSS/JS and QR code generation.
4. Run unit tests, `:app:assembleDebug`, `:app:lintDebug`; resolve failures.
   Document install, local upload instructions and physical-device verification
   boundary in app README. Leave work uncommitted for review.

## Verification result

Implemented all four tasks. `:app:testDebugUnitTest`, `:app:assembleDebug` and
`:app:lintDebug` pass (11 tests, zero lint errors, seven advisory warnings).
Bundled upload JavaScript passes `node --check`. The slow-upload regression was
observed failing before changing network streaming to use a separate lock.
Isolated emulator checks cover paired uploads, library rendering, D-pad
selection, fullscreen fit, slideshow persistence and pause/resume timing.
Physical Google TV launcher and extended Ambient Mode tests remain device checks.
