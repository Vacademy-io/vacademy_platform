# Vacademy iOS — App Store Rejection-Risk Checklist

What was hardened in code (this branch) vs. what **you must still do manually** in Xcode / App Store
Connect. The manual items below are the most likely remaining rejection causes — none of them can be
fixed from the codebase.

---

## ✅ Fixed in code (no action needed beyond build + OTA)

| Guideline | Risk | Fix |
|---|---|---|
| 3.1.1 / 3.1.3 | Paid/commerce, membership, "Access Days", catalogue, prices visible on iOS | `shouldHidePaidPurchaseUI()` gates all of it on **native iOS only** — a pure runtime check (`Capacitor.getPlatform() === "ios"`), no setting and nothing to toggle. Web / Android / desktop keep full commerce. |
| 3.1.1 | Enroll-by-invite "Upgrade Now" / "Complete Payment" → external gateways | Route guard on `/learner-invitation-response` + component gates (`enrollment-policy-dialog`, `payment-pending-step`, `enroll-form`). |
| 4.8 | Google/GitHub login on iOS with **no Sign in with Apple** | Social login (+ signup) hidden on native iOS. Email-OTP / username-password / phone remain. |
| 5.1.1(v) | In-app account deletion hidden by default | `useStudentPermissions` forces `canDeleteProfile = true` on iOS → Delete Account always reachable. |
| 5.1.2 | Amplitude analytics auto-tracking with no ATT prompt | Amplitude disabled on native iOS (`analytics.ts`). |
| 5.1.1 | Main `Info.plist` camera/mic strings said "property reviews and inspections" | Rewritten to learning-app wording. |
| 5.x | Export-compliance prompt every upload | `ITSAppUsesNonExemptEncryption = false` added to `App/Info.plist`. |
| 5.1.1 | Missing app-target privacy manifest (Capgo required-reason APIs) | `ios/App/App/PrivacyInfo.xcprivacy` created — **must be wired into targets, see #2 below**. |

### How the gate works (no configuration)
Hiding is driven entirely by `isIOSNative()` in `src/utils/ios-iap-compliance.ts` — there is **no admin
toggle, no institute setting, no remote flag**. The native iOS app always hides commerce + social login;
every other platform (web, Android, desktop) always shows them. This is deliberate: a remotely
re-enabled commerce/login surface after approval is exactly what gets an app pulled under Guideline
2.3.1. To legitimately sell or show social login on iOS later, implement StoreKit IAP / Sign in with
Apple (see #5), don't flip a switch.

---

## ⛔ You MUST do these manually (cannot be done from code)

### 1. Provide a demo account for App Review — **most common rejection (2.1)**
The app is a login wall: a reviewer with no institute account sees only a login screen (the iOS
reader-mode guard sends `/courses` back to login). App Review **will** reject unless you supply
credentials.
- App Store Connect → your app → **App Review Information → Sign-In Required → ON**.
- Enter a working **demo learner** username + password (and the institute subdomain in the notes) that
  lands on a **populated dashboard with real, free content**.
- Add reviewer notes: "Institution-managed LMS. Use the demo account to sign in; enrollment and any
  purchases are handled by the institute outside the app (reader app, Guideline 3.1.3)."

### 2. Wire `PrivacyInfo.xcprivacy` into every target (5.1.1)
The file exists but does nothing until it's in each target's build.
- Open `ios/App/App.xcworkspace` in Xcode → select `PrivacyInfo.xcprivacy` → **File Inspector →
  Target Membership**: check **App** and **all 7 per-institute targets** (the7cs, SSDC Horizon,
  Five Sep, Uplift Teacher Training, Shiksha Nation, Chanakaya IAS Academy, Edzumo).
- Archive and confirm there's no `ITMS-91053 Missing privacy manifest` warning.

### 3. APNs environment = production (2.1)
`ios/App/App/App.entitlements` commits `aps-environment = development`. A distribution build needs
`production` or push silently dies for real users (a reviewer testing notifications = rejection).
- Xcode **automatic signing usually rewrites this on archive** — but verify: after archiving, check the
  `.ipa`'s embedded entitlements show `aps-environment = production`. If you do manual/CI signing, set a
  Release entitlements file with `production`.

### 4. App Store Connect Privacy "Nutrition" Labels (5.1.1 / 5.1.2)
Declare data collection accurately and consistently with `PrivacyInfo.xcprivacy`:
- Firebase push → **Device ID / push token**, used for **App Functionality**, **not** tracking.
- Analytics is **off on iOS**, so do **not** declare tracking. (Keep it off, or you'll need an ATT prompt.)

### 5. (Optional) To show Google/GitHub login on iOS later — implement Sign in with Apple (4.8)
Social login is currently **hidden on iOS** because 4.8 requires Sign in with Apple parity. To bring it
back: add the `Sign in with Apple` capability to each target, add `@capacitor-community/apple-sign-in`,
render a "Continue with Apple" button, and wire backend Apple-token exchange. Then remove the
`!isIOSNative()` gates in `login-form.tsx` / `ModularDynamicLoginContainer.tsx` /
`ModularDynamicSignupContainer.tsx`.

---

## 🔧 Low-priority hygiene (won't reject, but worth cleaning)
- `UIRequiredDeviceCapabilities = armv7` in the 7 brand `GoogleService-Info.plist` files → change to
  `arm64` (the main target is already correct; iOS 15 is 64-bit only).
- Remove stale duplicate plists in `ios/App/` root (`STEMx-Info.plist`, `ithinkersByFiveSep-Info.plist`,
  `*copy-Info.plist`, `EnarkGoogleService-Info.plist`) — not used as any target's `INFOPLIST_FILE`;
  two are still copied into the bundle as inert resources.
- Strip the auth/institute `console.log` debug lines in `src/routes/__root.tsx` for release builds.

---

## Ship order
1. `npm run build` + `npx cap copy ios` (and `npx cap sync ios` if pods changed), then archive in Xcode.
2. Do manual items **#1–#4 above** before submitting.
3. Publish the learner **OTA** (`scripts/publish-ota.sh`, bump `package.json` version first) so existing
   installs pick up the JS-level gating.
4. Nothing to configure — iOS hiding is automatic at runtime. The native binary you submit for review is
   what matters (Info.plist + privacy manifest are native changes that OTA cannot deliver).
