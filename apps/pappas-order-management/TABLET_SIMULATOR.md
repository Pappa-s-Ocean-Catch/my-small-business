# Running on Tablet Simulators

This guide explains how to run the Pappas Order Management app on tablet simulators for iOS and Android.

## Prerequisites

- **iOS**: Xcode installed (macOS only)
- **Android**: Android Studio with Android SDK installed

## iOS Tablet Simulator

### Option 1: Using Expo CLI (Recommended)

1. **Start Expo and select a tablet simulator:**
   ```bash
   pnpm ios:tablet
   ```
   This will open the device selection menu where you can choose an iPad simulator.

2. **Or manually select device:**
   ```bash
   pnpm start
   # Then press 'i' to open iOS simulator
   # When prompted, select an iPad device (e.g., "iPad Pro (12.9-inch)")
   ```

### Option 2: Using Xcode Simulator Directly

1. **Open Xcode Simulator:**
   ```bash
   open -a Simulator
   ```

2. **Select an iPad device:**
   - Go to **File > Open Simulator**
   - Choose an iPad model (e.g., "iPad Pro (12.9-inch)" or "iPad Air")

3. **Start Expo:**
   ```bash
   pnpm start
   ```

4. **Press 'i' in the Expo terminal** to launch on the selected simulator

### Available iPad Simulators

Common iPad simulators you can use:
- iPad Pro (12.9-inch) - Best for testing large tablet layouts
- iPad Pro (11-inch)
- iPad Air
- iPad (10th generation)
- iPad mini

## Android Tablet Emulator

### Option 1: Using Expo CLI (Recommended)

1. **Start Expo and select a tablet emulator:**
   ```bash
   pnpm android:tablet
   ```
   This will open the device selection menu where you can choose a tablet emulator.

2. **Or manually select device:**
   ```bash
   pnpm start
   # Then press 'a' to open Android emulator
   # When prompted, select a tablet device
   ```

### Option 2: Using Android Studio AVD Manager

1. **Create a tablet emulator:**
   - Open Android Studio
   - Go to **Tools > Device Manager**
   - Click **Create Device**
   - Select **Tablet** category
   - Choose a tablet (e.g., "Pixel Tablet" or "Nexus 10")
   - Select a system image (API 33+ recommended)
   - Finish the setup

2. **Start the emulator:**
   - In Device Manager, click the ▶️ play button next to your tablet emulator
   - Wait for it to boot up

3. **Start Expo:**
   ```bash
   pnpm start
   ```

4. **Press 'a' in the Expo terminal** to launch on the running emulator

### Recommended Android Tablet Emulators

- **Pixel Tablet** (10.95", 2560x1600) - Modern Google tablet
- **Nexus 10** (10.1", 2560x1600) - Classic tablet reference
- **Galaxy Tab S8** - Samsung tablet reference

## Quick Commands

```bash
# Start Expo dev server
pnpm start

# iOS tablet (opens device selector)
pnpm ios:tablet

# Android tablet (opens device selector)
pnpm android:tablet

# Or use the standard commands and select device when prompted
pnpm ios      # Press 'i', then select iPad
pnpm android  # Press 'a', then select tablet
```

## Troubleshooting

### iOS Simulator Not Showing Tablets

- Ensure Xcode is installed and up to date
- Run `xcode-select --install` if needed
- Check that iPad simulators are available in Xcode > Settings > Platforms

### Android Emulator Not Found

- Ensure Android Studio is installed
- Set `ANDROID_HOME` environment variable
- Run `adb devices` to verify emulator is running
- Create a tablet AVD in Android Studio if none exist

### Device Not Appearing in Expo

- Make sure the simulator/emulator is running before starting Expo
- Try restarting the Expo dev server
- For iOS, ensure the simulator is fully booted (not just launched)
- For Android, check that `adb` can see the device: `adb devices`

## Landscape Orientation

The app is configured for landscape orientation, which is perfect for tablets. The orientation is set in `app.json`:

```json
"orientation": "landscape"
```

This ensures the app always displays in landscape mode, ideal for kitchen tablet use.
