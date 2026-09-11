# Makefile for Menu Display TV

# Include local configuration files if present
-include tv.config
-include .env

# Configuration defaults
TV_PORT ?= 5555
TV_IP ?= 192.168.1.100
TV_IPS ?= $(TV_IP)
PACKAGE_NAME ?= com.pappas.menudisplay
MAIN_ACTIVITY ?= $(PACKAGE_NAME)/.MainActivity

# Export variables to make them available to Gradle
export MENU_DISCOVERY_API_URL

GRADLE ?= unset ANDROID_PREFS_ROOT; ./gradlew

DEBUG_APK ?= app/build/outputs/apk/debug/app-debug.apk
RELEASE_APK ?= app/build/outputs/apk/release/app-release-unsigned.apk

.PHONY: help build-debug build-release \
        deploy deploy-debug deploy-release \
        connect disconnect launch test lint clean

.DEFAULT_GOAL := help

help:
	@echo "Menu Display TV - Build & Deploy Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make build:debug     (or make build-debug)   - Build debug APK"
	@echo "  make build:release   (or make build-release) - Build release APK"
	@echo "  make deploy          - Build debug APK and deploy to configured TV(s)"
	@echo "  make deploy:debug    (or make deploy-debug)  - Build debug APK and deploy to TV(s)"
	@echo "  make deploy:release  (or make deploy-release)- Build release APK and deploy to TV(s)"
	@echo "  make connect         - Connect ADB to configured TV IP address(es)"
	@echo "  make disconnect      - Disconnect ADB from TV(s)"
	@echo "  make launch          - Launch app on connected TV(s)"
	@echo "  make test            - Run unit tests (JVM and Node test)"
	@echo "  make lint            - Run Android lint"
	@echo "  make clean           - Clean build artifacts"
	@echo ""
	@echo "Configuration options (override on CLI or in tv.config / .env):"
	@echo "  TV_IP=<ip>          Single TV IP address (default: 192.168.1.100)"
	@echo "  TV_IPS=\"<ip1> <ip2>\" Multiple TV IP addresses (space separated)"
	@echo "  TV_PORT=<port>      ADB port (default: 5555)"
	@echo ""
	@echo "Examples:"
	@echo "  make deploy TV_IP=192.168.1.50"
	@echo "  make deploy TV_IPS=\"192.168.1.50 192.168.1.51 192.168.1.52\""

build\:debug: build-debug
build-debug:
	$(GRADLE) :app:assembleDebug

build\:release: build-release
build-release:
	$(GRADLE) :app:assembleRelease

connect:
	@for ip in $(TV_IPS); do \
		target=$$ip; \
		if ! echo "$$target" | grep -q ":"; then \
			target="$$target:$(TV_PORT)"; \
		fi; \
		echo "Connecting to $$target..."; \
		adb connect $$target; \
	done

disconnect:
	@for ip in $(TV_IPS); do \
		target=$$ip; \
		if ! echo "$$target" | grep -q ":"; then \
			target="$$target:$(TV_PORT)"; \
		fi; \
		echo "Disconnecting from $$target..."; \
		adb disconnect $$target; \
	done

deploy: deploy-debug
deploy\:debug: deploy-debug
deploy-debug: build-debug connect
	@for ip in $(TV_IPS); do \
		target=$$ip; \
		if ! echo "$$target" | grep -q ":"; then \
			target="$$target:$(TV_PORT)"; \
		fi; \
		echo "Deploying debug APK to $$target..."; \
		adb -s $$target install -t -d -r $(DEBUG_APK); \
	done

deploy\:release: deploy-release
deploy-release: build-release connect
	@for ip in $(TV_IPS); do \
		target=$$ip; \
		if ! echo "$$target" | grep -q ":"; then \
			target="$$target:$(TV_PORT)"; \
		fi; \
		if [ -f "$(RELEASE_APK)" ]; then \
			apk_to_install="$(RELEASE_APK)"; \
		elif [ -f "app/build/outputs/apk/release/app-release.apk" ]; then \
			apk_to_install="app/build/outputs/apk/release/app-release.apk"; \
		else \
			echo "Error: No release APK found in app/build/outputs/apk/release/"; \
			exit 1; \
		fi; \
		echo "Deploying release APK ($$apk_to_install) to $$target..."; \
		adb -s $$target install -t -d -r $$apk_to_install; \
	done

launch: connect
	@for ip in $(TV_IPS); do \
		target=$$ip; \
		if ! echo "$$target" | grep -q ":"; then \
			target="$$target:$(TV_PORT)"; \
		fi; \
		echo "Launching app on $$target..."; \
		adb -s $$target shell am start -n $(MAIN_ACTIVITY); \
	done

test:
	$(GRADLE) :app:testDebugUnitTest
	node --test tests/upload-page.test.cjs

lint:
	$(GRADLE) :app:lintDebug

clean:
	$(GRADLE) clean
