# POS Mirror Android - Technical Design Specification

## 1. Overview & Objective
`pos-mirror-android` is a lightweight, high-performance native Android application written in pure Kotlin targeting **Android 5.0+ (API 21+)** specifically designed to run on the **Citaq H10-3** commercial POS terminal (1024x768 landscape touchscreen, Rockchip RK3368, 2GB RAM) and standard Android tablets.

It reproduces the complete feature set of the existing React Native `apps/pos-mirror` like-for-like, removing all heavy JS/C++ runtime overhead and guaranteeing reliable, 24/7 standalone operation.

---

## 2. Target Platform & Constraints
- **Minimum SDK (`minSdkVersion`)**: 21 (Android 5.0 Lollipop)
- **Target SDK (`targetSdkVersion`)**: 34 (Android 14)
- **Screen Resolution**: 1024 x 768 Landscape (Primary target: Citaq H10-3)
- **Build Output**: Standalone APK (`pos-mirror-android-release.apk`), < 8MB in size.
- **Kiosk Features**: Fullscreen immersive mode (`SYSTEM_UI_FLAG_IMMERSIVE_STICKY`), wake lock (`FLAG_KEEP_SCREEN_ON`).

---

## 3. Technology Stack
- **Language**: Kotlin 1.9+
- **Build System**: Gradle 8.x with Android Gradle Plugin 8.x
- **UI Architecture**: Android Views + Material Components (`com.google.android.material:material:1.9.0`)
  - XML Layouts with Hardware Acceleration
  - `MaterialCardView` for elevated panels and cards
  - `RecyclerView` with `DiffUtil` for 60fps cart updates
- **Networking & Realtime**:
  - `OkHttp 4.12.0` (with TLS 1.2+ configuration for Android 5.0/5.1)
  - Native WebSocket client implementing the Supabase Realtime (Phoenix channel) protocol
  - REST client for Supabase Auth (`/auth/v1/token?grant_type=password`)
- **JSON Serialization**: `Gson` (minimal binary footprint, zero runtime issues on Android 5)
- **Image Loading**: `Coil` or lightweight native bitmap decoder / `Glide 4.x` for local & remote artwork.
- **Local Persistence**: Android `SharedPreferences`

---

## 4. UI Design & Brand Aesthetics
Bespoke color palette extracted directly from Pappas brand tokens:
- **Background**: `#FFF1F2` (Rose 50)
- **Primary / Brand**: `#E11D48` (Rose 600)
- **Accent / Info**: `#2563EB` (Blue 600)
- **Surface**: `#FFFFFF`
- **Text Primary**: `#881337` (Rose 900)
- **Text Muted**: `#475569` (Slate 600)
- **Ready Badge**: `#087443`
- **Preparing Badge**: `#9A6700`

### Screen Layouts:
1. **Login Screen**:
   - Centered elevated card on `#FFF1F2` background.
   - Email and Password inputs with Material outlined design.
   - Sign In button with loading spinner state.
   - Persistent error banner for invalid credentials.

2. **Settings Screen**:
   - Register ID selector / text input (e.g., `pos-1`, `pos-2`).
   - Radio group for Idle Mode: `Idle Image` vs `Customer Queue`.
   - Save button & Sign Out button.

3. **Customer Display Screen (Landscape 1024x768)**:
   - **Active Cart State (Split 65% / 35%)**:
     - **Left Panel (Items)**:
       - Header: "Your order", item count badge, green pulsing "LIVE" indicator.
       - Column headers: `QTY`, `ITEM`, `EACH`, `TOTAL`.
       - RecyclerView displaying lines:
         - Large `2×` quantity in `#E11D48`.
         - Item title + optional `Customized` pill badge.
         - Price per item & line total.
         - Tapping a line with customizations shows a dialog modal.
     - **Right Panel (Summary)**:
       - "TOTAL TO PAY" label.
       - Huge bold total amount (e.g. `$45.50`).
       - Discount callout if applicable (`Includes $X.XX discount`).
       - Divider line.
       - "ORDERS PREPPING" box with live queue count.
       - Secret unlock: Tapping the total amount 5 times reveals the Settings button.
   - **Idle States**:
     - **Idle Image**: Displays full-height promotional artwork (`idle-artwork.jpg`) centered, with subtle settings gear icon in top right.
     - **Customer Queue**: Two-column board: "READY FOR PICKUP" (green cards) and "PREPARING" (amber cards).
   - **Connection Banner**: Floats at the bottom in warning amber if network disconnects, auto-hides upon reconnect.

---

## 5. Supabase Realtime Protocol
The app connects to Supabase Realtime WebSocket endpoint:
`wss://ytoxlssjgzpuxyrfzfqb.supabase.co/realtime/v1/websocket?apikey=<ANON_KEY>&vsn=1.0.0`
- Sends Phoenix join topic: `realtime:public:pos_mirror_state:register_id=eq.<REGISTER_ID>`
- Handles incoming `INSERT`, `UPDATE`, `DELETE` events for table `pos_mirror_state`.
- Periodically sends Phoenix heartbeat (`phx` event `heartbeat`) every 30 seconds.
- Automatically handles reconnection with exponential backoff.

---

## 6. Project Directory Structure
```
apps/pos-mirror-android/
├── build.gradle.kts (or build.gradle)
├── settings.gradle.kts
├── gradle/
│   └── wrapper/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/pappas/posmirror/
│       │   ├── App.kt
│       │   ├── data/
│       │   │   ├── models/ (Snapshot, OrderLine, QueueEntry)
│       │   │   └── repository/ (AuthRepository, SettingsRepository)
│       │   ├── network/
│       │   │   ├── SupabaseAuthClient.kt
│       │   │   └── SupabaseRealtimeClient.kt
│       │   ├── ui/
│       │   │   ├── login/LoginActivity.kt
│       │   │   ├── settings/SettingsActivity.kt
│       │   │   ├── display/DisplayActivity.kt
│       │   │   └── adapter/OrderLineAdapter.kt
│       │   └── util/ (Formatters, Constants, Sound/WakeLock)
│       └── res/
│           ├── layout/ (activity_login, activity_settings, activity_display, item_order_line)
│           ├── values/ (colors, strings, styles, dimens)
│           └── drawable/ (badges, backgrounds, icons)
```
