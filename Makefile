# Root Makefile for my-small-business repository
-include .env

.PHONY: help dev pos-mirror-dev pos-mirror-build pos-mirror-release pos-mirror-deploy pos-mirror-clean pos-mirror-logs pos-mirror-screenshot

help:
	@echo "Repository Automation Commands:"
	@echo ""
	@echo "POS Mirror Android (apps/pos-mirror-android):"
	@echo "  make dev                    Boot Android simulator, build, install & run POS Mirror"
	@echo "  make pos-mirror-dev         Same as make dev"
	@echo "  make pos-mirror-build       Build debug APK"
	@echo "  make pos-mirror-release     Build release APK"
	@echo "  make pos-mirror-deploy      Build, install release APK to device, and launch"
	@echo "  make pos-mirror-clean       Clean Gradle build cache"
	@echo "  make pos-mirror-logs        Stream logcat output from device"
	@echo "  make pos-mirror-screenshot  Capture screenshot from device"
	@echo ""
	@echo "You can also navigate to apps/pos-mirror-android/ and run:"
	@echo "  make dev | make build | make release | make deploy | make logs | make screenshot"

dev: pos-mirror-dev

pos-mirror-dev:
	$(MAKE) -C apps/pos-mirror-android dev

pos-mirror-build:
	$(MAKE) -C apps/pos-mirror-android build

pos-mirror-release:
	$(MAKE) -C apps/pos-mirror-android release

pos-mirror-deploy:
	$(MAKE) -C apps/pos-mirror-android deploy

pos-mirror-clean:
	$(MAKE) -C apps/pos-mirror-android clean

pos-mirror-logs:
	$(MAKE) -C apps/pos-mirror-android logs

pos-mirror-screenshot:
	$(MAKE) -C apps/pos-mirror-android screenshot
