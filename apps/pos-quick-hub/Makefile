# Pappa's Quick Hub Makefile
.PHONY: build release clean install-to-hub

build:
	./gradlew assembleDebug

release:
	./gradlew assembleRelease

clean:
	./gradlew clean

update-install: release
	cp app/build/outputs/apk/release/app-release.apk ../../install/pappas-quick-hub.apk
	@echo "Copied release APK to ../../install/pappas-quick-hub.apk"
