# OTA (Over-the-Air) Live Update Guide

The learner app supports OTA updates — pushing web bundle updates directly to iOS/Android devices without going through app stores. This works because the app is a React web bundle running inside a Capacitor native shell.

## How It Works

1. Admin runs `publish-ota.sh` → builds the web bundle, zips it, uploads to S3, registers the version
2. App opens → checks backend for new version → downloads bundle in background
3. `CapacitorUpdater.set()` reloads the app with the new bundle immediately
4. If the new bundle crashes (doesn't call `notifyAppReady()` within 10s), the plugin auto-rolls back

## Prerequisites

The `@capgo/capacitor-updater` plugin must be installed in the native shell. This requires a **one-time app store release** (see below). After that, all web bundle updates are OTA.

---

## One-Time: App Store Release

This installs the native plugin into the app binary. Only needed once.

### Android

```bash
cd frontend-learner-dashboard-app

# Sync plugin to native project
npx cap sync android

# Bump versionCode in android/app/build.gradle for each flavor
# e.g. ssdc: versionCode 24 → 25, seven_cs: versionCode 20 → 21

# Build release APK/AAB per flavor
pnpm android:assemble:ssdc:release
pnpm android:assemble:seven_cs:release
# repeat for fivesep, shikshanation, enark

# Upload each AAB to Google Play Console
```

### iOS

```bash
# Sync plugin to native project
npx cap sync ios

# Open in Xcode
npx cap open ios

# Bump version for each target/scheme
# Archive → Upload to App Store Connect → Submit for review
```

---

## Ongoing: Publishing OTA Updates

### 1. Bump version

```bash
cd frontend-learner-dashboard-app
npm version patch   # 1.0.3 → 1.0.4 (or edit package.json manually)
```

### 2. Run the publish script

**Push to all institutes:**

```bash
BACKEND_URL=https://backend-stage.vacademy.io \
ADMIN_JWT_TOKEN=<your-jwt> \
./scripts/publish-ota.sh
```

**Push to a specific institute (canary):**

```bash
BACKEND_URL=https://backend-stage.vacademy.io \
ADMIN_JWT_TOKEN=<your-jwt> \
TARGET_APP_IDS="com.sevencs.app,com.sevencs.learner" \
./scripts/publish-ota.sh
```

**Force update (blocks app until applied):**

```bash
BACKEND_URL=https://backend-stage.vacademy.io \
ADMIN_JWT_TOKEN=<your-jwt> \
FORCE_UPDATE=true \
./scripts/publish-ota.sh
```

**Set minimum native version (skip devices on old native shell):**

```bash
BACKEND_URL=https://backend-stage.vacademy.io \
ADMIN_JWT_TOKEN=<your-jwt> \
MIN_NATIVE_VERSION=2.1.6 \
./scripts/publish-ota.sh
```

### Script Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKEND_URL` | Yes | — | Backend base URL |
| `ADMIN_JWT_TOKEN` | Yes | — | Admin JWT for API authentication |
| `PLATFORM` | No | `ALL` | Target: `ALL`, `ANDROID`, `IOS` |
| `MIN_NATIVE_VERSION` | No | `1.0.0` | Minimum native shell version required |
| `FORCE_UPDATE` | No | `false` | Block app until update is applied |
| `TARGET_APP_IDS` | No | all | Comma-separated app IDs for institute targeting |
| `RELEASE_NOTES` | No | — | Release notes text |

---

## Institute Targeting (App IDs)

| Institute | Android App ID | iOS Bundle ID |
|-----------|---------------|---------------|
| SSDC | `io.vacademy.student.app` | `io.ssdc.student.app` |
| 7Cs | `com.sevencs.app` | `com.sevencs.learner` |
| Fivesep | `com.fivesep.app` | `io.fivesep.student.app` |
| Shiksha Nation | `com.shikshanation.new.app` | — |
| Enark | `com.enarkuplift.app` | `io.enarkuplift.app` |

When targeting a specific institute, include **both** Android and iOS app IDs:

```bash
TARGET_APP_IDS="com.sevencs.app,com.sevencs.learner"
```

When `TARGET_APP_IDS` is not set, all institutes receive the update.

---

## Staged Rollout Example

```
Day 1:  Push to 7Cs only
        TARGET_APP_IDS="com.sevencs.app,com.sevencs.learner" ./scripts/publish-ota.sh

Day 2:  Verify no crashes in logs, check user feedback

Day 3:  Push to all institutes (register a new version without TARGET_APP_IDS)
        ./scripts/publish-ota.sh
```

---

## Rollback

### Automatic (client-side)

If the new bundle crashes on load, `@capgo/capacitor-updater` auto-reverts to the previous working bundle within 10 seconds. No action needed.

### Manual (server-side)

Deactivate a bad version — all clients stop receiving it on next check:

```bash
curl -X PUT "${BACKEND_URL}/admin-core-service/admin/ota/v1/${VERSION_ID}/deactivate" \
  -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}"
```

Re-activate if needed:

```bash
curl -X PUT "${BACKEND_URL}/admin-core-service/admin/ota/v1/${VERSION_ID}/activate" \
  -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}"
```

List all versions to find the ID:

```bash
curl "${BACKEND_URL}/admin-core-service/admin/ota/v1/versions?page=0&size=10" \
  -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}"
```

---

## When to Use OTA vs App Store

| Change | Method |
|--------|--------|
| UI changes, new pages, bug fixes | OTA |
| API calls, business logic, styling | OTA |
| New assets (images, fonts loaded at runtime) | OTA |
| Add a new Capacitor plugin | App store release |
| Change Android/iOS permissions | App store release |
| Upgrade Capacitor major version | App store release |
| Change app icon or splash screen | App store release |
| Change app name or bundle ID | App store release |

---

## API Endpoints

### Public (called by the app)

```
GET /admin-core-service/public/ota/v1/check
    ?platform=ANDROID
    &currentBundleVersion=1.0.3
    &nativeVersion=2.1.6
    &appId=com.sevencs.app
```

### Admin (requires JWT)

```
POST /admin-core-service/admin/ota/v1/register          — Register a new version
GET  /admin-core-service/admin/ota/v1/versions           — List all versions (paginated)
PUT  /admin-core-service/admin/ota/v1/{id}/deactivate    — Deactivate a version
PUT  /admin-core-service/admin/ota/v1/{id}/activate      — Re-activate a version
```

---

## Architecture

```
publish-ota.sh
    │
    ├── pnpm build → dist/
    ├── zip dist/ → bundle.zip
    ├── Upload to S3 (via media_service presigned URL)
    └── Register version (via admin_core_service API)

App Launch
    │
    ├── notifyAppReady()          ← confirms current bundle is healthy
    ├── GET /ota/v1/check         ← checks for new version
    │   ├── No update → done
    │   └── Update available
    │       ├── Force → download + apply immediately (blocking overlay)
    │       └── Optional → show banner, user clicks "Update"
    │
    └── CapacitorUpdater.download() → .set() → app reloads with new bundle
```

## Key Files

- `scripts/publish-ota.sh` — CI publish script
- `src/services/ota-update.ts` — Frontend OTA check/download/apply logic
- `src/stores/useOtaUpdate.ts` — Zustand store for OTA state
- `src/components/ota-update/OtaUpdateBanner.tsx` — Update UI (banner + force overlay)
- `src/routes/__root.tsx` — OTA check on app mount
- `capacitor.config.ts` — Plugin configured with `autoUpdate: false`
