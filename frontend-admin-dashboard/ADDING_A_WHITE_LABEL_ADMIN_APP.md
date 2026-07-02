# Adding a white-label admin app for another institute

The admin app ships as **per-institute white-label builds** (like the learner app).
Today there is one: **`vacademy-admin`** (`io.vacademy.admin.app`, `dash.vacademy.io`).
Adding another institute is mostly **data-driven** — the Android product flavor,
app name, and Firebase wiring are generated from a manifest, so you don't edit
build logic.

## The single key

Each app has one **kebab-case slug** used everywhere, e.g. `sunrise-academy`:

| Used as | Value |
|---|---|
| `android/app/mobile-flavors.json` key | `sunrise-academy` |
| `GoogleServiceConfigs/<key>/` folder (both platforms) | `sunrise-academy` |
| `flavor.config.ts` `ADMIN_FLAVORS` key | `sunrise-academy` |
| `VITE_CAP_FLAVOR` build env | `sunrise-academy` |
| Gradle product flavor (auto-derived, no hyphens) | `sunriseAcademy` |
| iOS Xcode target | `Sunrise Academy` (your choice) |

`vacademy-admin` → Gradle flavor `vacademyAdmin`. The slug → camelCase mapping is
automatic in `android/app/build.gradle`.

---

## Steps

### 1. Register the apps in Firebase
Under the `vacademy-app` project (or the institute's own), add an **Android app**
and an **iOS app** with the institute's bundle id (e.g. `com.sunrise.admin.app`).
Download `google-services.json` + `GoogleService-Info.plist`, and upload the
**APNs key** (iOS push). See [`ios/App/GoogleServiceConfigs/README.md`](./ios/App/GoogleServiceConfigs/README.md).

### 2. Drop the Firebase config files
```
android/app/GoogleServiceConfigs/sunrise-academy/google-services.json
ios/App/GoogleServiceConfigs/sunrise-academy/GoogleService-Info.plist
```

### 3. Add the Android flavor — **just one JSON entry** (`android/app/mobile-flavors.json`)
```json
"sunrise-academy": {
  "applicationId": "com.sunrise.admin.app",
  "appName": "Sunrise Admin",
  "deepLinkHost": "sunrise.vacademy.io"
}
```
That's all Android needs: `build.gradle` generates the `sunriseAcademy` product
flavor, sets `app_name`, and copies `GoogleServiceConfigs/sunrise-academy/google-services.json`
into the flavor's source set on the next build.

### 4. Add the web/branding flavor — **one entry** (`flavor.config.ts` → `ADMIN_FLAVORS`)
```ts
'sunrise-academy': {
    key: 'sunrise-academy',
    appId: 'com.sunrise.admin.app',
    appName: 'Sunrise Admin',
    forceVimShell: false,
    brandingDomain: 'vacademy.io',
    brandingSubdomain: 'sunrise',        // → institute_domain_routing row for theme/title/logo
    instituteId: '<institute-uuid>',
    ota: 'self-hosted',
},
```
The `AdminFlavorKey` type and `isAdminFlavorKey()` pick it up automatically — no
other TypeScript edits.

### 5. Branding icons & splash
- **Android:** `android/app/src/sunriseAcademy/res/` — `mipmap-*` launcher icons +
  `drawable-*/splash.png`. Mirror an existing flavor's folder. (Icons must override
  `ic_launcher_foreground`/`_background` or the adaptive icon falls back to Vacademy.)
  `app_name` + `title_activity_main` come from `mobile-flavors.json` automatically,
  but `package_name` / `custom_url_scheme` default to the Vacademy bundle in
  `src/main/res/values/strings.xml`; for a **different bundle id**, override both in
  `android/app/src/sunriseAcademy/res/values/strings.xml`.
- **iOS:** add a `SunriseIcon.appiconset` (single 1024² PNG, **no alpha**).

### 6. iOS target — **the one manual step (Xcode can't be data-driven)**
Duplicate the **App** target in Xcode and set, on the new target:
- `PRODUCT_BUNDLE_IDENTIFIER = com.sunrise.admin.app`
- `ASSETCATALOG_COMPILER_APPICON_NAME = SunriseIcon`
- point its `GoogleService-Info.plist` Copy-Bundle-Resource at
  `GoogleServiceConfigs/sunrise-academy/GoogleService-Info.plist`

This mirrors the learner app's per-institute targets. (Android needs no equivalent
manual step — flavors are generated.)

### 7. (Optional) convenience npm scripts
Mirror the `vacademy-admin` scripts in `package.json` for the new key/flavor
(`cap:sync:sunrise-academy`, `android:assemble:sunrise-academy:release`, …).

---

## Build

```bash
# Android
cross-env VITE_CAP_FLAVOR=sunrise-academy pnpm run build \
  && cross-env VITE_CAP_FLAVOR=sunrise-academy npx cap sync android \
  && (cd android && ./gradlew bundleSunriseAcademyRelease)   # .aab for Play

# iOS
cross-env VITE_CAP_FLAVOR=sunrise-academy pnpm run build \
  && cross-env VITE_CAP_FLAVOR=sunrise-academy npx cap sync ios \
  && npx cap open ios   # archive the "Sunrise Academy" scheme
```

For the existing app, the ready-made scripts are `pnpm run cap:sync:vacademy-admin`,
`pnpm run android:assemble:vacademy-admin:release`, etc.
