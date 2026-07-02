# Vacademy Admin — App Store & Play Store Submission

End-to-end runbook for shipping the **Vacademy Admin** app (`io.vacademy.admin.app`) to the
Google Play Store and Apple App Store. See `CAPACITOR_VACADEMY_ADMIN.md` for the app architecture
(flavors, OTA, native config).

---

## 0. What's already done (in this repo)

| Item | Status |
|---|---|
| App icons (adaptive + round + iOS 1024 opaque) + splash | ✅ generated from `assets/` (Vacademy "V") |
| Android product flavor `vacademyAdmin` (`io.vacademy.admin.app`, "Vacademy Admin") | ✅ `android/app/mobile-flavors.json` + `build.gradle` |
| Android FCM (`google-services.json`) | ✅ `android/app/GoogleServiceConfigs/vacademy-admin/` (project `vacademy-app`) |
| Android release signing config | ✅ `build.gradle` reads `android/keystore.properties` |
| Android **upload keystore** | ✅ generated → `android/app/vacademy-admin-upload.jks` (+ `android/keystore.properties`) — **BACK UP** (§2) |
| iOS FCM (`GoogleService-Info.plist`) wired into Xcode Resources | ✅ `ios/App/GoogleServiceConfigs/vacademy-admin/` |
| iOS version / build | ✅ `MARKETING_VERSION 1.0.1`, `CURRENT_PROJECT_VERSION 2` |
| Release build scripts | ✅ `android:bundle:vacademy-admin:release`, etc. |

**You still need (accounts / assets only you can provide):**
- Google Play Console account (one-time $25) + Apple Developer Program ($99/yr).
- Store listing assets: screenshots, feature graphic, description, **privacy policy URL**.
- Apple: signing Team + (Xcode-managed) certificates/profiles.

---

## 1. Versioning (bump every upload)

- **Android**: `android/app/build.gradle` → `versionCode` (integer, **must increase every upload**) + `versionName` (e.g. `1.0.1`).
- **iOS**: Xcode target → `MARKETING_VERSION` (e.g. `1.0.1`) + `CURRENT_PROJECT_VERSION` (build number, must increase per upload to the same version).
- **OTA bundle** (JS-only updates, no store review): `package.json` `version` must be **> the native versionName** and globally unique — see `CAPACITOR_VACADEMY_ADMIN.md`.

---

## 2. Android — Google Play

### 2a. Signing key ⚠️ CRITICAL — BACK THIS UP
- Upload keystore: `android/app/vacademy-admin-upload.jks`; passwords in `android/keystore.properties` (both **git-ignored**).
- **Copy both to a password manager / secure vault now.** If lost *and* you did NOT enroll Play App Signing, you can never update the app again.
- **Enroll in Play App Signing** (default for new apps) on first upload — then this is only the *upload* key and Google can reset it if lost.
- To generate your OWN key instead of the provided one:
  ```bash
  keytool -genkeypair -v -keystore android/app/vacademy-admin-upload.jks \
    -alias vacademy-admin -keyalg RSA -keysize 2048 -validity 10000
  ```
  then update `android/keystore.properties`.
- Upload-key SHA-256 (register with Firebase/API key restrictions if needed): run
  `keytool -list -keystore android/app/vacademy-admin-upload.jks`.

### 2b. Build the signed release AAB
```bash
cd frontend-admin-dashboard
pnpm run build:vacademy-admin            # fresh production web bundle
pnpm run cap:sync:vacademy-admin:fast    # copy dist + config into android
pnpm run android:bundle:vacademy-admin:release
# → android/app/build/outputs/bundle/vacademyAdminRelease/app-vacademyAdmin-release.aab
```
(Requires JDK 21 + Android SDK; `JAVA_HOME=/opt/homebrew/opt/openjdk@21`, `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`.)

### 2c. Play Console
1. Create app → name "Vacademy Admin", default language, app (not game), free.
2. **App integrity → Play App Signing**: enroll (accept Google-managed signing).
3. Complete: **Store listing** (short/full description, icon 512×512, feature graphic 1024×500, ≥2 phone screenshots), **Privacy policy URL**, **Data safety** form, **Content rating** questionnaire, **Target audience**, **Ads** declaration, **App access** (provide test admin creds for review — e.g. a `ca3c…` / demo admin).
4. **Production → Create release** → upload the `.aab` → review → roll out. (Start with **Internal testing** track to validate before Production.)

---

## 3. iOS — Apple App Store

### 3a. One-time setup
- Full **Xcode** installed (this machine: `/Volumes/shreyash_ex/Applications/Xcode.app`; `sudo xcode-select -s <path>/Contents/Developer`).
- **Apple Developer Program** membership.
- App Store Connect → **App record**: bundle id `io.vacademy.admin.app`, name "Vacademy Admin".
- Xcode → App target → **Signing & Capabilities** → check *Automatically manage signing* → select your **Team** (creates certs/profiles). Add **Push Notifications** capability (FCM) + set the APNs key in the Firebase console.

### 3b. Build & upload
```bash
cd frontend-admin-dashboard
pnpm run build:vacademy-admin
pnpm run cap:sync:vacademy-admin:fast
pnpm run cap:open:vacademy-admin:ios      # opens Xcode
```
In Xcode: select **Any iOS Device (arm64)** → **Product → Archive** → **Distribute App → App Store Connect → Upload**. (Or CLI: `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -archivePath build/App.xcarchive archive` then `xcodebuild -exportArchive …` with an `ExportOptions.plist`, requires your Team.)

### 3c. App Store Connect
- **App Privacy** questionnaire, screenshots (6.7" + 5.5", and iPad if supported), description, keywords, support URL, **privacy policy URL**.
- **Sign-in required for review**: provide a demo admin account in *App Review Information* (reviewers must be able to log in).
- Submit for review.

> ⚠️ iOS pitfalls already handled in this project (don't regress): `iosScheme: https` + `CapacitorCookies` (login cookies), `scrollEnabled: true`, `@capacitor/keyboard` removed (IME), real `GoogleService-Info.plist` wired. See `CAPACITOR_VACADEMY_ADMIN.md`.

---

## 4. Pre-submission checklist (both)
- [ ] Fresh `build:vacademy-admin` + `cap sync` before archiving/bundling.
- [ ] versionCode / build number bumped.
- [ ] Login works on a **fresh install** (any-institute admin → own institute; verified on emulator+simulator).
- [ ] Icons + splash show the Vacademy "V" (no Capacitor placeholder).
- [ ] Privacy policy URL live.
- [ ] Demo admin credentials ready for reviewers.
- [ ] Backend `resolve-by-institute` newline fix + OTA strict-targeting deployed (see memory / `CAPACITOR_VACADEMY_ADMIN.md`).
- [ ] `institute_domain_routing` `admin-app` row `institute_id` newline cleaned (so branding/theme resolves).
