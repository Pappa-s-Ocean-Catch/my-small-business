# POS Mirror Android Makefile
# Include local .env if it exists
-include .env

DEVICE_IP ?= 192.168.4.68
DEVICE_PORT ?= 5555
DEVICE_TARGET := $(DEVICE_IP):$(DEVICE_PORT)
PACKAGE_NAME := com.pappas.posmirror
MAIN_ACTIVITY := com.pappas.posmirror.ui.display.DisplayActivity
RELEASE_APK := app/build/outputs/apk/release/app-release.apk
DEBUG_APK := app/build/outputs/apk/debug/app-debug.apk

.PHONY: all help dev simulator build debug release clean deploy deploy-release deploy-debug connect disconnect restart start stop logs screenshot logs-emulator screenshot-emulator

help:
	@echo "============================================="
	@echo "       POS Mirror Android Automation"
	@echo "============================================="
	@echo "Target device : $(DEVICE_TARGET)"
	@echo ""
	@echo "Local Simulator Commands:"
	@echo "  make dev            Boot emulator, build, install & run POS Mirror"
	@echo "  make simulator      Same as make dev"
	@echo "  make logs-emulator  Stream logcat from the active emulator"
	@echo "  make screenshot-emu Capture screen from emulator to screenshot.png"
	@echo ""
	@echo "Physical Terminal Commands:"
	@echo "  make build          Build debug APK"
	@echo "  make release        Build release APK"
	@echo "  make clean          Clean build cache"
	@echo "  make connect        Connect ADB over WiFi to $(DEVICE_TARGET)"
	@echo "  make disconnect     Disconnect ADB"
	@echo "  make deploy         Build & install release APK to device and launch"
	@echo "  make deploy-release Same as make deploy"
	@echo "  make deploy-debug   Build & install debug APK to device and launch"
	@echo "  make start          Start the app on device"
	@echo "  make stop           Force stop the app on device"
	@echo "  make restart        Restart the app on device"
	@echo "  make logs           Stream logcat logs from device"
	@echo "  make screenshot     Capture screen from device into screenshot.png"
	@echo "============================================="

dev:
	@./scripts/run-dev.sh

simulator: dev

logs-emulator:
	@EMU=$$(adb devices | grep -E 'emulator-[0-9]+' | head -n 1 | awk '{print $$1}'); \
	if [ -z "$$EMU" ]; then echo "❌ No running emulator found"; exit 1; fi; \
	adb -s $$EMU logcat | grep -i --color=auto posmirror

screenshot-emu: screenshot-emulator

screenshot-emulator:
	@EMU=$$(adb devices | grep -E 'emulator-[0-9]+' | head -n 1 | awk '{print $$1}'); \
	if [ -z "$$EMU" ]; then echo "❌ No running emulator found"; exit 1; fi; \
	adb -s $$EMU shell screencap -p /sdcard/pos_mirror_screen.png; \
	adb -s $$EMU pull /sdcard/pos_mirror_screen.png screenshot-emulator.png; \
	adb -s $$EMU shell rm /sdcard/pos_mirror_screen.png; \
	echo "Saved emulator screenshot to screenshot-emulator.png"

build: debug

debug:
	./gradlew assembleDebug

release:
	./gradlew assembleRelease

clean:
	./gradlew clean

connect:
	@echo "Connecting to $(DEVICE_TARGET)..."
	@adb connect $(DEVICE_TARGET)

disconnect:
	@echo "Disconnecting from $(DEVICE_TARGET)..."
	@adb disconnect $(DEVICE_TARGET)

deploy: release deploy-release-only

deploy-release: release deploy-release-only

deploy-release-only:
	@echo "Connecting to $(DEVICE_TARGET)..."
	@adb connect $(DEVICE_TARGET) || true
	@STATUS=$$(adb devices | grep -E '^$(DEVICE_TARGET)[[:space:]]+' | awk '{print $$2}'); \
	if [ "$$STATUS" != "device" ]; then \
		echo ""; \
		echo "❌ Device $(DEVICE_TARGET) is not ready (status: $${STATUS:-not connected})."; \
		echo "👉 On your physical Citaq terminal:"; \
		echo "   1. Wake up the screen if it is black/sleeping."; \
		echo "   2. If an 'Allow USB debugging?' popup appears, check 'Always allow' and tap OK."; \
		echo "   3. If still offline, toggle Wi-Fi OFF and ON in Android Settings (or reboot the terminal)."; \
		echo ""; \
		exit 1; \
	fi
	@echo "Installing $(RELEASE_APK)..."
	@adb -s $(DEVICE_TARGET) install -r $(RELEASE_APK)
	@echo "Launching $(PACKAGE_NAME)..."
	@adb -s $(DEVICE_TARGET) shell am start -n $(PACKAGE_NAME)/$(MAIN_ACTIVITY)
	@echo "Deployed successfully!"

deploy-debug: debug
	@echo "Connecting to $(DEVICE_TARGET)..."
	@adb connect $(DEVICE_TARGET) || true
	@STATUS=$$(adb devices | grep -E '^$(DEVICE_TARGET)[[:space:]]+' | awk '{print $$2}'); \
	if [ "$$STATUS" != "device" ]; then \
		echo ""; \
		echo "❌ Device $(DEVICE_TARGET) is not ready (status: $${STATUS:-not connected})."; \
		echo "👉 On your physical Citaq terminal:"; \
		echo "   1. Wake up the screen if it is black/sleeping."; \
		echo "   2. If an 'Allow USB debugging?' popup appears, check 'Always allow' and tap OK."; \
		echo "   3. If still offline, toggle Wi-Fi OFF and ON in Android Settings (or reboot the terminal)."; \
		echo ""; \
		exit 1; \
	fi
	@echo "Installing $(DEBUG_APK)..."
	@adb -s $(DEVICE_TARGET) install -r $(DEBUG_APK)
	@echo "Launching $(PACKAGE_NAME)..."
	@adb -s $(DEVICE_TARGET) shell am start -n $(PACKAGE_NAME)/$(MAIN_ACTIVITY)
	@echo "Deployed debug build successfully!"

start:
	@adb -s $(DEVICE_TARGET) shell am start -n $(PACKAGE_NAME)/$(MAIN_ACTIVITY)

stop:
	@adb -s $(DEVICE_TARGET) shell am force-stop $(PACKAGE_NAME)

restart: stop start

logs:
	@adb -s $(DEVICE_TARGET) logcat | grep -i --color=auto posmirror

screenshot:
	@adb -s $(DEVICE_TARGET) shell screencap -p /sdcard/pos_mirror_screen.png
	@adb -s $(DEVICE_TARGET) pull /sdcard/pos_mirror_screen.png screenshot.png
	@adb -s $(DEVICE_TARGET) shell rm /sdcard/pos_mirror_screen.png
	@echo "Saved screenshot to screenshot.png"
