# Vimotion mobile (Capacitor)

The admin dashboard is now Capacitor-enabled so we can ship the Vimotion routes
(`/vim/*`) as a native iOS + Android app without forking the codebase. On web
the Capacitor layer is a no-op — `initNative()` only sets the safe-area + keyboard
CSS variables (which the responsive web build also uses).

App identity: `io.vimotion.app` / "Vimotion" (`capacitor.config.ts`).

---

## First-time setup (developer machine)

```bash
cd vacademy_platform/frontend-admin-dashboard

# 1. Build the web bundle Capacitor will package
pnpm run build

# 2. Generate the native projects (one-time; creates ios/ and android/ folders)
pnpm cap:add:ios
pnpm cap:add:android

# 3. Sync the web bundle + plugins into the native projects
pnpm cap:sync
```

### iOS prerequisites
- macOS + Xcode 15+
- CocoaPods (`brew install cocoapods`)
- An Apple developer team configured in Xcode for code signing

### Android prerequisites
- Android Studio Hedgehog (2023.1) or newer
- Android SDK 34+
- JDK 17

---

## Daily dev loop

```bash
# After web changes (most common — Vite HMR not used by native builds):
pnpm cap:sync:fast        # copy dist/ into ios/ and android/ without rebuild
pnpm cap:open:ios         # opens Xcode → cmd+R
pnpm cap:open:android     # opens Android Studio → ▶

# One-shot rebuild + run on device/simulator:
pnpm cap:run:ios
pnpm cap:run:android
```

For live-reload against the Vite dev server, uncomment the `server.url` block
in `capacitor.config.ts` and point it at your machine's LAN IP (e.g.
`http://192.168.1.20:5173`). Sync once, then run the app — file changes will
hot-reload inside the native shell.

---

## What's wired

| Concern | File | Notes |
| --- | --- | --- |
| Init orchestration | `index.ts` | Called once from `src/index.tsx` before React mounts. |
| Platform detection | `platform.ts` | `isNative()` / `isIOS()` / `isAndroid()` |
| Safe area | `safeArea.ts` | Sets `--safe-area-inset-*` CSS vars; use `.pt-safe`/`.pb-safe` utilities. |
| Status bar | `statusBar.ts` | Vimotion default = paper white + dark icons. Override via `setStatusBar()`. |
| Splash screen | `splashScreen.ts` | Auto-hidden by the vim shell on first paint. |
| Keyboard | `keyboard.ts` | Publishes `--keyboard-height`; sticky bars use `.pb-keyboard`. |
| Push notifications | `pushNotifications.ts` | FCM via `@capacitor-firebase/messaging`. Token registered after login. |
| Deep links | `deepLinks.ts` | `vimotion://` custom scheme + `vimotion.app` Universal Links. |
| OTA updates | `ota.ts` | Capgo. Configure `CAPGO_APP_ID` + `CAPGO_API_KEY` in CI. |
| Privacy screen | `privacyScreen.ts` | Blurs app in task switcher; iOS + Android. |

The vim shell (Login, Onboarding, Dashboard) mounts `useVimotionNativeShell()`
which (a) hides the splash on first paint and (b) listens for `vim:deep-link`
events to route via TanStack Router.

---

## Remaining work before App Store / Play Store

1. **Native config files** (after `cap add ios/android`):
   - `ios/App/App/Info.plist` — add `NSCameraUsageDescription`, `NSMicrophoneUsageDescription` (for avatar capture if added), `LSApplicationQueriesSchemes` for `vimotion`.
   - `android/app/src/main/AndroidManifest.xml` — add intent filters for `vimotion://` scheme + `vimotion.app` Universal Links, set `windowSoftInputMode="adjustNothing"` on the launch activity.

2. **Firebase setup**:
   - iOS: download `GoogleService-Info.plist` → drag into `ios/App/App/`.
   - Android: download `google-services.json` → place in `android/app/`.
   - Apply Google Services plugin in `android/app/build.gradle`.

3. **Universal Links**:
   - Host `apple-app-site-association` at `https://vimotion.app/.well-known/apple-app-site-association`.
   - Host `assetlinks.json` at `https://vimotion.app/.well-known/assetlinks.json`.

4. **Splash + icons** — generate via `@capacitor/assets` (installed on demand;
   not in `package.json` because it's a one-shot generator, not a runtime dep):
   ```bash
   pnpm add -D @capacitor/assets
   mkdir -p assets/native
   # Drop icon.png (1024×1024) and splash.png (2732×2732) into assets/native/
   npx capacitor-assets generate --assetPath ./assets/native
   ```
   Without this step the privacy screen's `imageName: 'Splash'` in
   `capacitor.config.ts` resolves to a missing drawable on Android (shows a
   black panel in the recents view) and the iOS splash falls back to the
   default Capacitor logo.

5. **OTA channel** — `npx @capgo/cli login`, create app + channels (`production`, `staging`).

6. **App Tracking Transparency** (iOS) — if we add any analytics that fingerprint
   the device, add `NSUserTrackingUsageDescription` to `Info.plist` and prompt.
