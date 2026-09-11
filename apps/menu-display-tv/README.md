# Menu Display for Google TV

Standalone native Kotlin MVP for Google TV / Android TV (Android 8.0+).
This is **not an Apple tvOS app** and has no POS, cloud or account dependencies.

## Build and install

Prerequisites: JDK 17, Android SDK Platform 36, Android SDK build tools, and
`ANDROID_HOME` pointing to the SDK (or an untracked `local.properties` containing
`sdk.dir=/your/android/sdk`). Gradle wrapper is included.

### Quick start with Makefile

A `Makefile` is included for quick building and local network TV deployment:

```sh
cd apps/menu-display-tv

# Build targets
make build:debug
make build:release

# Deploy to local network TV(s)
make deploy TV_IP=192.168.1.100
make deploy:release TV_IP=192.168.1.100

# Deploy to multiple TVs on local network
make deploy TV_IPS="192.168.1.100 192.168.1.101 192.168.1.102"

# Connect, launch, test & lint
make connect TV_IP=192.168.1.100
make launch TV_IP=192.168.1.100
make test
make lint
```

You can also copy `tv.config.example` to `tv.config` (or `.env`) to save your TV IP addresses permanently without committing them:

```sh
cp tv.config.example tv.config
# Edit tv.config: TV_IPS=192.168.1.100 192.168.1.101
make deploy
```

### Manual Gradle & ADB commands

```sh
cd apps/menu-display-tv
./gradlew :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
node --test tests/upload-page.test.cjs
adb connect TV_IP:5555
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Enable developer options / debugging on your TV first. Some TVs require
`adb pair TV_IP:PAIRING_PORT` before connecting to their displayed debugging port.
Use the address/port shown by your device. Launch **Menu Display** from the TV's
apps list. The generated APK is a debug build; production signing and Play Store
submission are not configured.

## Use

1. Choose **Upload images** on the TV.
2. Scan its QR code or open its `http://TV_IP:8787/` address from a phone/computer
   on the same LAN. Guest-network client isolation can prevent this connection.
3. **Step 1 — Pair:** enter the six-digit TV code and choose **Pair with TV**.
   Wait for **Paired with TV** before continuing.
4. **Step 2 — Upload:** choose one or multiple images and select **Upload to TV**.
   Only the pairing block is shown initially; it is replaced by the upload block
   after confirmation. Each page load checks the pairing saved in this browser
   with the TV first; valid pairing opens Upload directly. A failed check clears
   the saved pairing and shows code entry again. An expired code or lost
   upload connection requires pairing again.
5. Return to the library. Select a thumbnail, then **Display fullscreen**, **Rename**
   or **Delete**. Delete also removes that image from the saved slideshow.
6. For a slideshow, choose **Create slideshow**, add images, use **Move up/down**,
   select an interval (5, 10, 15, 30 or 60 seconds), then **Play slideshow**.

During playback: **OK / Enter** pauses or resumes a slideshow; **Left / Right**
steps between images; **Back** returns to the library. Library navigation uses
only the D-pad and OK. Menus fit entirely within the screen, with black bars when
aspect ratios differ. The app respects supported EXIF orientation metadata.
The last started image/slideshow is persisted and resumes when the app reopens.
Slideshow editor changes are saved when Play is selected; leaving the editor
without playing discards those edits. Resume starts at the first playlist image.

## Local storage and network behavior

- JPG, PNG and WebP; actual file content must decode as a supported image.
- 20 MiB per upload, 50 megapixels per source, 200 images / 500 MiB per library.
- Images and metadata reside in app-private storage. Uninstalling or clearing
  app data removes them. No account, internet access, or external storage permission.
- Atomic metadata updates; interrupted uploads are removed. Missing files are
  removed from saved playlists; damaged catalog metadata triggers file recovery.
- Opening Upload images shows feedback immediately while network lookup and QR
  generation run on a dedicated background worker. Leaving the screen discards
  any pending result.
- Thumbnail pages contain up to 12 images. Decoding is sampled and runs off the
  UI thread. Slow network uploads do not hold the library's metadata lock.
- Upload listener runs only while the Activity is foreground, including playback.
  Leaving the app closes active connections; reopening rotates the pairing code.
- Five incorrect pairing attempts lock uploads for 30 seconds. Only same-origin
  browser uploads are accepted. Headers, upload body and worker queue are bounded.
- This is local **HTTP**, intended for a trusted shop LAN. Do not forward port
  8787 to the internet. The QR contains only the URL, not the pairing code.
- WebP animations are treated as still images. Videos, cloud sync, scheduling,
  device-owner kiosk restrictions and launch-on-boot are outside this MVP.

## Keeping the screen on

The fullscreen Activity sets `FLAG_KEEP_SCREEN_ON` and hides system bars globally. The
flag prevents the TV's screen saver from showing at all times when the app is active
in the foreground. Home and Power remain available. Configure the physical TV's separate
auto-off / energy saving timers as needed. This app does not take over the launcher or
modify system screensaver settings, but will suppress the screensaver while the app is open.

Android references: [TV app setup](https://developer.android.com/training/tv/can get-started/create),
[TV navigation](https://developer.android.com/training/tv/get-started/navigation),
[Ambient Mode](https://developer.android.com/training/tv/playback/ambient-mode).

## Verification

Automated tests cover authorization before body reads, successful uploads through
real sockets, cross-origin rejection, upload size bounds, playlist reconciliation,
wrapping, durable rename/delete, truncated-upload cleanup, catalog recovery,
non-blocking library access during uploads, and playback wake-flag cleanup.

14 Android/JVM tests and 10 browser-flow unit tests pass; debug APK build and Android lint complete with no
errors (seven advisory warnings). Emulator smoke checks confirmed paired upload
of two PNGs, D-pad image selection, fullscreen fit with all image borders
visible, playlist persistence, pause holding beyond the interval, and resume
advancing to the next image. Reinstalling the final debug APK preserved the
library and resumed saved playback; Back returned to the library.

The implementation has been built and linted and exercised in an isolated
Android emulator at 1920 × 1080 with TV-sized density. The available emulator
system image is **Android phone/tablet**, not a Google TV system image; emulator
results do not establish actual Google TV Ambient Mode behavior.

Before shop deployment, verify on the target TV:

- App appears in launcher; every library/editor/action/dialog is D-pad reachable.
- Upload from a real phone over the shop LAN; wrong code and invalid images fail.
- Single image remains fullscreen beyond the configured screensaver timeout.
- Slideshow advances, wraps, pauses/resumes and survives app close/reopen offline.
- Portrait and 4K menus show all text without cropping; rename/delete persist.
- Home/Power work and stopping playback restores normal screen-idle behavior.
- Run an extended shop-hours playback test with the TV's power settings configured.
