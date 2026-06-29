# GoogleServiceConfigs — Firebase configs (Vacademy Admin app)

Firebase config files for the **admin** native apps. Each platform has a
`GoogleServiceConfigs/` folder *inside* its native project, with **one subfolder
per flavor** (= the `VITE_CAP_FLAVOR` key) that you paste the config file into —
the same layout on both platforms:

```
ios/App/GoogleServiceConfigs/
└── vacademy-admin/
    └── GoogleService-Info.plist          # iOS   (bundle  io.vacademy.admin.app)

android/app/GoogleServiceConfigs/
└── vacademy-admin/
    └── google-services.json              # Android (package io.vacademy.admin.app)
```

- **iOS** — the App target references `GoogleServiceConfigs/vacademy-admin/GoogleService-Info.plist`
  directly (Copy Bundle Resources). No copy step, no `ios/App/App/GoogleService-Info.plist`
  duplicate — same idea as the learner app's `ios/App/GoogleServiceConfigs/<Name>/`.
- **Android** — `android/app/build.gradle` copies
  `GoogleServiceConfigs/<flavor>/google-services.json` →
  `android/app/google-services.json` at configure time, then applies the
  `com.google.gms.google-services` plugin. The copied
  `android/app/google-services.json` is **git-ignored** (generated) — the
  registry subfolder is the single source of truth. Select another flavor folder
  with `-PfirebaseInstitute=<folder>`.

> ⚠️ The committed files are **format-valid placeholders** (real `vacademy-app`
> project number / bucket, but fake app id / API keys). The apps **build and
> launch** with them, but **push notifications won't work** until you replace
> them with the real files from the Firebase console.

---

## Register the apps in Firebase (the one step that can't be scripted)

The admin apps live under the existing **`vacademy-app`** Firebase project
(project #`117550803134`) — the same project the learner apps use. You're just
adding two new apps to it (one Android, one iOS), both bundle id
**`io.vacademy.admin.app`**.

1. Firebase console → project **`vacademy-app`** → ⚙️ **Project settings** → *Your apps*.
2. **Add Android app**
   - Android package name: `io.vacademy.admin.app`
   - App nickname: `Vacademy Admin (Android)`
   - (SHA-1 optional — only for Google Sign-In / Dynamic Links)
   - Download **`google-services.json`** → overwrite
     `android/app/GoogleServiceConfigs/vacademy-admin/google-services.json`.
     (Gradle copies it to `android/app/google-services.json` on the next build.)
3. **Add iOS app**
   - Apple bundle ID: `io.vacademy.admin.app`
   - App nickname: `Vacademy Admin (iOS)`
   - Download **`GoogleService-Info.plist`** → overwrite
     `ios/App/GoogleServiceConfigs/vacademy-admin/GoogleService-Info.plist`.
     (Nothing else to copy — the App target already references it here.)
4. (Push only) Upload the **APNs auth key** under *Project settings → Cloud
   Messaging → Apple app configuration* so iOS push is delivered.
5. Rebuild + sync:
   ```bash
   pnpm run cap:sync:vacademy-admin
   ```

---

## Add another flavor later

The admin app currently ships a single branded flavor (`vacademy-admin`), but the
layout supports more (e.g. a white-label admin app on its own bundle id):

1. In Firebase, register that institute's Android + iOS app under its **own** bundle id.
2. Add a matching Capacitor flavor in [`../../../flavor.config.ts`](../../../flavor.config.ts)
   (new `key`/`appId`/`appName`/`instituteId`).
3. iOS: drop its plist in `ios/App/GoogleServiceConfigs/<flavor-key>/` and add an
   Xcode target (the way the learner app does per institute).
4. Android: drop its json in `android/app/GoogleServiceConfigs/<flavor-key>/` and
   build with `-PfirebaseInstitute=<flavor-key>`.

---

## Why there's no Podfile

The admin iOS project is **Swift Package Manager** (`ios/App/CapApp-SPM/Package.swift`)
— there is **no `Podfile`**, and one must not be added (it conflicts with SPM).
The `GoogleService-Info.plist` is wired straight into the App target's *Copy Bundle
Resources* phase, which is all Firebase needs to initialise. The admin plist is
**pure Firebase** (the App target keeps its own separate `Info.plist`), unlike the
learner app where the plist doubles as each target's `INFOPLIST_FILE`.
