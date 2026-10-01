#!/usr/bin/env bash
set -e

# Determine Android SDK path
if [ -z "$ANDROID_HOME" ]; then
    if [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
    elif [ -d "/Users/truongnguyen/Library/Android/sdk" ]; then
        export ANDROID_HOME="/Users/truongnguyen/Library/Android/sdk"
    fi
fi

if [ -n "$ANDROID_HOME" ]; then
    export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
fi

if ! command -v emulator >/dev/null 2>&1; then
    echo "❌ Error: 'emulator' command not found. Please ensure Android SDK is installed."
    exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
    echo "❌ Error: 'adb' command not found. Please ensure Android SDK platform-tools are installed."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR"

# Check if emulator is already running
RUNNING_EMULATOR=$(adb devices | grep -E 'emulator-[0-9]+' | head -n 1 | awk '{print $1}')

if [ -z "$RUNNING_EMULATOR" ]; then
    AVAILABLE_AVDS=$(emulator -list-avds)
    if [ -z "$AVAILABLE_AVDS" ]; then
        echo "❌ Error: No Android Virtual Devices (AVD) found. Please create one in Android Studio."
        exit 1
    fi

    # Prefer tablet for POS landscape display, otherwise user-supplied or first AVD
    if [ -n "$AVD_NAME" ]; then
        SELECTED_AVD="$AVD_NAME"
    elif echo "$AVAILABLE_AVDS" | grep -q "^tablet$"; then
        SELECTED_AVD="tablet"
    else
        SELECTED_AVD=$(echo "$AVAILABLE_AVDS" | head -n 1)
    fi

    echo "🚀 Starting Android emulator ($SELECTED_AVD)..."
    emulator -avd "$SELECTED_AVD" >/dev/null 2>&1 &

    echo "⏳ Waiting for emulator to register with ADB..."
    adb wait-for-device

    # Give it a moment to assign device ID
    sleep 3
    RUNNING_EMULATOR=$(adb devices | grep -E 'emulator-[0-9]+' | head -n 1 | awk '{print $1}')

    echo "⏳ Waiting for Android system to finish booting..."
    while [ "$(adb -s "$RUNNING_EMULATOR" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
        sleep 2
    done
    echo "✅ Emulator ($RUNNING_EMULATOR) is booted and ready!"
else
    echo "✅ Found active emulator: $RUNNING_EMULATOR"
fi

echo "📦 Building debug APK..."
./gradlew assembleDebug

echo "📲 Installing APK to emulator ($RUNNING_EMULATOR)..."
adb -s "$RUNNING_EMULATOR" install -r app/build/outputs/apk/debug/app-debug.apk

echo "🚀 Launching POS Mirror..."
adb -s "$RUNNING_EMULATOR" shell am start -n com.pappas.posmirror/.ui.login.LoginActivity

echo ""
echo "========================================================"
echo "🎉 POS Mirror is now running in simulator ($RUNNING_EMULATOR)!"
echo "To view live logs: make logs-emulator"
echo "To take a screenshot: make screenshot-emulator"
echo "========================================================"
