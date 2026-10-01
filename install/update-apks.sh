#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${DIR}/.." && pwd)"

echo "🔄 Updating APKs in ${DIR}..."

# 1. Quick Hub
if [ -f "${ROOT}/apps/pos-quick-hub/app/build/outputs/apk/release/app-release.apk" ]; then
    cp "${ROOT}/apps/pos-quick-hub/app/build/outputs/apk/release/app-release.apk" "${DIR}/pappas-quick-hub.apk"
    echo "  ✅ Updated pappas-quick-hub.apk"
fi

# 2. POS Mirror
if [ -f "${ROOT}/apps/pos-mirror-android/app/build/outputs/apk/release/app-release.apk" ]; then
    cp "${ROOT}/apps/pos-mirror-android/app/build/outputs/apk/release/app-release.apk" "${DIR}/pos-mirror.apk"
    echo "  ✅ Updated pos-mirror.apk"
fi

# 3. Order Management
if [ -f "${ROOT}/apps/pappas-order-management/app-release.apk" ]; then
    cp "${ROOT}/apps/pappas-order-management/app-release.apk" "${DIR}/pappas-order-management.apk"
    echo "  ✅ Updated pappas-order-management.apk"
elif [ -f "${ROOT}/apps/pappas-order-management/android/app/build/outputs/apk/release/app-release.apk" ]; then
    cp "${ROOT}/apps/pappas-order-management/android/app/build/outputs/apk/release/app-release.apk" "${DIR}/pappas-order-management.apk"
    echo "  ✅ Updated pappas-order-management.apk"
fi

echo "🎉 All APKs up to date in install/"
