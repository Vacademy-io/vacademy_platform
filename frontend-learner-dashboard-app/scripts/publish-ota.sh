#!/usr/bin/env bash
#
# publish-ota.sh — Build, zip, upload, and register an OTA bundle.
#
# Required env vars:
#   BACKEND_URL       — Backend base URL (e.g. https://backend-stage.vacademy.io)
#   ADMIN_JWT_TOKEN   — Admin JWT for registering the version
#
# Optional env vars:
#   PLATFORM          — Target platform: ALL (default), ANDROID, IOS
#   MIN_NATIVE_VERSION — Minimum native shell version required (default: 1.0.0)
#   FORCE_UPDATE      — true/false (default: false)
#   TARGET_APP_IDS    — Comma-separated app IDs for institute targeting (default: all)
#   RELEASE_NOTES     — Release notes text
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Read version from package.json
VERSION=$(node -p "require('$APP_DIR/package.json').version")
PLATFORM="${PLATFORM:-ALL}"
MIN_NATIVE_VERSION="${MIN_NATIVE_VERSION:-1.0.0}"
FORCE_UPDATE="${FORCE_UPDATE:-false}"
TARGET_APP_IDS="${TARGET_APP_IDS:-}"
RELEASE_NOTES="${RELEASE_NOTES:-}"

echo "==> Publishing OTA bundle v${VERSION} (platform=${PLATFORM})"

# 1. Build
echo "==> Building web assets..."
cd "$APP_DIR"
pnpm build

# 2. Zip
BUNDLE_NAME="learner-bundle-${VERSION}.zip"
echo "==> Creating bundle zip: ${BUNDLE_NAME}"
cd dist
zip -r "../${BUNDLE_NAME}" .
cd "$APP_DIR"

# 3. Checksum
CHECKSUM=$(shasum -a 256 "$BUNDLE_NAME" | awk '{print $1}')
BUNDLE_SIZE=$(stat -f%z "$BUNDLE_NAME" 2>/dev/null || stat --format=%s "$BUNDLE_NAME")
echo "==> Checksum: ${CHECKSUM}"
echo "==> Size: ${BUNDLE_SIZE} bytes"

# 4. Upload to S3 via media_service presigned URL
echo "==> Getting presigned upload URL..."
PRESIGNED_RESPONSE=$(curl -s -X POST \
  "${BACKEND_URL}/media-service/public/get-signed-url" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}" \
  -d "{
    \"file_name\": \"${BUNDLE_NAME}\",
    \"file_type\": \"application/zip\",
    \"source\": \"OTA_BUNDLE\",
    \"source_id\": \"LEARNER_APP\"
  }")

UPLOAD_URL=$(echo "$PRESIGNED_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))" 2>/dev/null)
FILE_ID=$(echo "$PRESIGNED_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -z "$UPLOAD_URL" ] || [ -z "$FILE_ID" ]; then
  echo "ERROR: Failed to get presigned URL. Response: $PRESIGNED_RESPONSE"
  exit 1
fi

echo "==> Uploading bundle to S3..."
curl -s -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/zip" \
  --data-binary "@${BUNDLE_NAME}"

# 5. Get the public download URL
echo "==> Resolving public download URL..."
PUBLIC_URL_RESPONSE=$(curl -s -X GET \
  "${BACKEND_URL}/media-service/public/get-public-url?fileId=${FILE_ID}" \
  -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}")
DOWNLOAD_URL=$(echo "$PUBLIC_URL_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('url', d) if isinstance(d, dict) else d)" 2>/dev/null || echo "$PUBLIC_URL_RESPONSE")

if [ -z "$DOWNLOAD_URL" ]; then
  echo "ERROR: Failed to get public URL."
  exit 1
fi

# 6. Register the version
echo "==> Registering OTA version v${VERSION}..."
REGISTER_BODY=$(cat <<EOF
{
  "version": "${VERSION}",
  "platform": "${PLATFORM}",
  "bundle_file_id": "${FILE_ID}",
  "bundle_download_url": "${DOWNLOAD_URL}",
  "checksum": "${CHECKSUM}",
  "bundle_size_bytes": ${BUNDLE_SIZE},
  "min_native_version": "${MIN_NATIVE_VERSION}",
  "force_update": ${FORCE_UPDATE},
  "target_app_ids": $([ -n "$TARGET_APP_IDS" ] && echo "\"${TARGET_APP_IDS}\"" || echo "null"),
  "release_notes": $([ -n "$RELEASE_NOTES" ] && echo "\"${RELEASE_NOTES}\"" || echo "null")
}
EOF
)

REGISTER_RESPONSE=$(curl -s -X POST \
  "${BACKEND_URL}/admin-core-service/admin/ota/v1/register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}" \
  -d "$REGISTER_BODY")

echo "==> Registration response: ${REGISTER_RESPONSE}"

# Cleanup
rm -f "$BUNDLE_NAME"

echo ""
echo "==> OTA v${VERSION} published successfully!"
echo "    Platform:           ${PLATFORM}"
echo "    Min native version: ${MIN_NATIVE_VERSION}"
echo "    Force update:       ${FORCE_UPDATE}"
echo "    Target app IDs:     ${TARGET_APP_IDS:-all}"
echo "    Checksum:           ${CHECKSUM}"
