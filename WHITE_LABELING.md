# White Labeling Guide

This document explains how to create and maintain client-branded builds (Android/iOS/Web/Electron). Example brand used below: `seven_cs`.

## What changes per brand
- App identity: package id (Android), bundle id (iOS), product name (Electron), web domain
- Display name and icon set; splash screen images
- Deep link host(s)
- Optional: Backend base URL, Firebase Web config (can reuse same Firebase project)

## Prerequisites and decisions (fill before starting)
- Brand key (short, lowercase): `<brand>` (e.g., `seven_cs`)
- App name: e.g., `Seven CS Learner`
- Android package id: e.g., `com.sevencs.learner`
- iOS bundle id: e.g., `com.sevencs.learner`
- Web domain(s): e.g., `learn.sevencs.com`
- Deep link host(s): e.g., `learn.sevencs.com`
- Icon assets: Android densities, iOS AppIcon, Electron `.ico`/`.icns`
- Splash assets: portrait/landscape variants (optional per brand)

## Quick start checklist (high-level)
1) Create Android flavor and resources; add `google-services.json`
2) Create iOS target/scheme; add `GoogleService-Info.plist`; enable Push capability
3) Add `.env.<brand>`; (optional) brand-specific web service worker
4) Electron config and icons
5) Firebase Console: add Android/iOS apps (+ optional Web app), APNs/VAPID, SHA fingerprints
6) Build and validate push notifications, deep links, icons, and splash screens

## Android
### Flavors
- Defined in `android/app/build.gradle` under `productFlavors`:
  - `ssdc` (default), `seven_cs`.
  - Each flavor sets `applicationId`, `resValue("string", "app_name", ...)`, and `manifestPlaceholders.DEEP_LINK_HOST`.

### Files and Assets
- Place Firebase config: `android/app/src/<flavor>/google-services.json`.
- Override icons per flavor: `android/app/src/<flavor>/res/mipmap-*/*`.
- Optional per-flavor strings: `android/app/src/<flavor>/res/values/strings.xml`.

### Build
```bash
npx cap sync android
cd android
./gradlew assembleSeven_csDebug
./gradlew assembleSeven_csRelease
```

### Firebase Android App
- In the Firebase project, add an Android app with package id `com.sevencs.learner`.
- Download `google-services.json` and place under `android/app/src/seven_cs/`.
- Add SHA‑1 and SHA‑256 for debug and release keystores.

## iOS
### Targets and Schemes
- Duplicate the `App` target in Xcode to a new target `SevenCS`.
- Set:
  - Bundle Identifier: `com.sevencs.learner`
  - Display Name: `Seven CS Learner`
- Add brand icons/splash in `Assets.xcassets` and ensure the `SevenCS` target uses them.
 - Capabilities: enable Push Notifications; enable Background Modes → Remote notifications

### Firebase iOS App
- In Firebase, add an iOS app with bundle id `com.sevencs.learner`.
- Download `GoogleService-Info.plist` and add to the `SevenCS` target (Build Phases > Copy Bundle Resources).

### Build
```bash
npx cap sync ios
# Build the SevenCS scheme in Xcode
```

## Web
### Env-Driven Firebase Config
- `src/services/firebase-config.ts` reads from Vite env (`VITE_*`).
- Create `.env.seven_cs` in repo root:
```ini
VITE_BRAND=seven_cs
VITE_APP_NAME="Seven CS Learner"
# Firebase web app (reuse or set specific values)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_FIREBASE_VAPID_KEY=...
# Optional API base URL override
# VITE_BASE_URL=https://backend-stage.vacademy.io
```

### Service Worker (optional per brand)
- If needed, use `public/firebase-messaging-sw.seven_cs.js` and copy it to `public/firebase-messaging-sw.js` during build/deploy.
 - Ensure the service worker file is served from site root (`/firebase-messaging-sw.js`). If you deploy via a CDN/reverse proxy, verify the path mapping.

### Build
```bash
# Vite mode or env
npm run build -- --mode seven_cs
# or
VITE_BRAND=seven_cs npm run build
```

## Electron (Windows/Mac)
- Config file: `electron/electron-builder.seven_cs.json`.
- Update icons in `electron/assets/seven_cs.ico` and `electron/assets/seven_cs.icns`.

### Build
```bash
# Windows
npx electron-builder -c electron/electron-builder.seven_cs.json -w
# macOS
npx electron-builder -c electron/electron-builder.seven_cs.json -m
```

## Push Notifications
- Client sends token + `clientContext` (package/bundle id or web sender id) and `instituteId`.
- Server selects correct Firebase credentials per app, and targets tokens by instituteId.

## Naming and Icons Checklist
- Android package id: unique per brand
- iOS bundle id: unique per brand
- Web site icon and manifest (optional brand favicon)
- Electron icons (.ico/.icns)

## Frequently Asked Questions
- Can multiple brands share the same Firebase project? Yes. Add separate Android/iOS apps (and optional Web apps) in the same project.
- Do I need different SHA certificates? Yes, for each Android app you should add debug and release SHA hashes to Firebase.
- How do I switch brands locally? Use the flavor/scheme on native; use Vite mode or env for web.

## How to add a new client brand (end‑to‑end)

Follow these steps to add a brand named `acme` as an example. Replace names/domains accordingly.

1) Android
- Edit `android/app/build.gradle`:
  - Under `productFlavors`, add:
    ```gradle
    acme {
        dimension "client"
        applicationId "com.acme.learner"
        resValue "string", "app_name", "ACME Learner"
        manifestPlaceholders.DEEP_LINK_HOST = "app.acme.com"
    }
    ```
- Create directories and resources:
  - `android/app/src/acme/google-services.json` (download from Firebase Android app for package `com.acme.learner`).
  - `android/app/src/acme/res/values/strings.xml` (optional if using `resValue` already):
    ```xml
    <?xml version="1.0" encoding="utf-8"?>
    <resources>
    	<string name="app_name">ACME Learner</string>
    	<string name="title_activity_main">ACME Learner</string>
    </resources>
    ```
  - Icons (if different from default): place PNGs in each density folder:
    - `android/app/src/acme/res/mipmap-hdpi/ic_launcher.png`
    - `.../mipmap-xhdpi/ic_launcher.png`, `.../ic_launcher_round.png`, etc.
  - Splash (optional): provide `splash.png` in `drawable-port-*` and `drawable-land-*` under `android/app/src/acme/res/` to override.
- Firebase Console:
  - Add a new Android app in the existing Firebase project with package id `com.acme.learner`.
  - Add SHA‑1 and SHA‑256 for your debug and release keystores.
- Build:
  ```bash
  npx cap sync android
  cd android
  ./gradlew assembleAcmeDebug
  ./gradlew assembleAcmeRelease
  ```

2) iOS
- In Xcode, duplicate the `App` target → name it `Acme`.
- Set:
  - Bundle Identifier: `com.acme.learner`
  - Display Name: `ACME Learner`
- Assets:
  - Add brand icons and splash in `Assets.xcassets` and assign them to the `Acme` target.
- Firebase Console:
  - Add an iOS app in the same Firebase project with bundle id `com.acme.learner`.
  - Download `GoogleService-Info.plist` and include in the `Acme` target (Build Phases > Copy Bundle Resources).
- Build:
  ```bash
  npx cap sync ios
  # Select the Acme scheme and build/run in Xcode
  ```

3) Web
- Create env file in repo root `.env.acme`:
  ```ini
  VITE_BRAND=acme
  VITE_APP_NAME="ACME Learner"
  # Firebase web app (reuse existing or add a new Web app and paste values)
  VITE_FIREBASE_API_KEY=...
  VITE_FIREBASE_AUTH_DOMAIN=...
  VITE_FIREBASE_PROJECT_ID=...
  VITE_FIREBASE_STORAGE_BUCKET=...
  VITE_FIREBASE_MESSAGING_SENDER_ID=...
  VITE_FIREBASE_APP_ID=...
  VITE_FIREBASE_MEASUREMENT_ID=...
  VITE_FIREBASE_VAPID_KEY=...
  # Optional API base URL override per brand
  # VITE_BASE_URL=https://api.acme.com
  ```
- Service Worker (optional per brand): duplicate `public/firebase-messaging-sw.seven_cs.js` to `public/firebase-messaging-sw.acme.js` and fill config if you use a distinct Web app; deploy it under `firebase-messaging-sw.js` for the acme site.
- Build:
  ```bash
  npm run build -- --mode acme
  # or
  VITE_BRAND=acme npm run build
  ```

4) Electron (Windows/Mac)
- Create `electron/electron-builder.acme.json`:
  ```json
  {
    "appId": "com.acme.learner",
    "productName": "ACME Learner",
    "directories": { "buildResources": "resources" },
    "files": ["assets/**/*","build/**/*","capacitor.config.*","app/**/*"],
    "win": { "target": ["nsis:x64","portable"], "icon": "assets/acme.ico" },
    "mac": { "category": "public.app-category.education", "target": "dmg", "icon": "assets/acme.icns" }
  }
  ```
- Place icons: `electron/assets/acme.ico`, `electron/assets/acme.icns`.
- Build:
  ```bash
  npx electron-builder -c electron/electron-builder.acme.json -w  # Windows
  npx electron-builder -c electron/electron-builder.acme.json -m  # macOS
  ```

5) Backend (push notifications)
- No code change required if you reuse the same Firebase project service account.
- Ensure your push token registration captures `instituteId` and `clientContext` (already implemented).
- If you introduce different Firebase projects per brand, map `clientContext` → Firebase Admin credentials when sending messages.

6) CI/CD tips
- Android: create jobs per flavor (e.g., `assembleAcmeRelease`).
- iOS: use separate scheme per brand and export options.
- Web: pass `--mode <brand>` or `VITE_BRAND=<brand>` env to build job and deploy to brand domain.
- Electron: run builder with brand-specific config and publish to dedicated channels if needed.

7) Naming/assets checklist
- Unique package/bundle ids.
- Icons for Android densities; iOS AppIcon set; Electron .ico/.icns.
- Optional brand favicon and PWA manifest for web.

## Validation checklist (do these on every brand)
- Android
  - App name and icons show correctly
  - Deep links to `https://<DEEP_LINK_HOST>/assessment/examination` and `/assessment/reports` open the app
  - Push token logs on first run and server receives token with correct `clientContext`
- iOS
  - App name and icons show correctly
  - Push capability enabled; device receives remote notifications
  - Deep links behave as expected (Associated Domains if you enable Universal Links)
- Web
  - `.env.<brand>` values are reflected in built app (check console logs for Firebase sender id)
  - `firebase-messaging-sw.js` is registered; background notifications appear
- Electron
  - Product name and icons are correct in installer/app
- Server
  - Token registration includes `instituteId` and `clientContext` (verify logs)
  - Sending notifications targets correct audience and brand

## Firebase Console checklist for new clients

Use one Firebase project with multiple apps (recommended). For each new client/brand:

- Android app
  - Project settings → General → Your apps → Add app → Android
  - Package name: e.g., `com.<brand>.learner`
  - Download `google-services.json` and place under `android/app/src/<brand>/google-services.json`
  - Add SHA fingerprints (Project settings → Your apps → Android app → Add fingerprint)
    - Debug keystore SHA‑1 and SHA‑256
    - Release keystore SHA‑1 and SHA‑256
    - If Google Play App Signing is enabled, also add the Play “App signing certificate” SHA‑1/256

- iOS app
  - Project settings → General → Your apps → Add app → iOS
  - Bundle ID: e.g., `com.<brand>.learner`
  - Download `GoogleService-Info.plist` and include in the new iOS target (Build Phases → Copy Bundle Resources)
  - Cloud Messaging → Apple app configuration: upload APNs Auth Key (`.p8`) once for the project (recommended) or per-app certificates

- Web app (optional per brand)
  - Project settings → General → Your apps → Add app → Web
  - Copy the Web config (apiKey, authDomain, etc.) into `.env.<brand>`
  - Cloud Messaging → Web configuration → Web Push certificates: generate/reuse VAPID key and put the public key in `VITE_FIREBASE_VAPID_KEY`
  - If using Firebase Auth: Authentication → Settings → Authorized domains → add brand domain(s)

- Server credentials (Cloud Messaging)
  - If all brands share the same Firebase project, reuse the same service account on the server
  - If a brand uses a different Firebase project, map `clientContext` to the correct credentials when sending

- Where to copy values from
  - Android/iOS app cards: download `google-services.json` / `GoogleService-Info.plist`
  - Web app card: copy the web config object into `.env.<brand>`
  - Cloud Messaging: copy VAPID public key for web; configure APNs for iOS

- After console setup
  - Android: add `google-services.json`, verify Gradle flavor, build
  - iOS: add `GoogleService-Info.plist` to the new target, enable Push capability, build
  - Web: add `.env.<brand>`, (optionally) brand service worker, build/deploy to brand domain

