# Sign in with Apple — Learner App (iOS)

**Status:** P0 shipped (native iOS). P1 (Android/web redirect) not started.
**Scope:** `auth_service` + `frontend-learner-dashboard-app` (Capacitor iOS).
**Last updated:** 2026-06-21

---

## 1. Why this exists

The learner app offers Google + GitHub social login. **Apple App Store Guideline 4.8** requires that any iOS app offering third-party social login also offer **Sign in with Apple** as an equivalent, peer option. Before this work, Google/GitHub were *hidden on native iOS* (`!isIOSNative()` gates) precisely to avoid a 4.8 rejection.

This feature adds native Sign in with Apple on iOS, which let us **remove those gates** — so iOS now shows **Google, GitHub, and Apple together**. This is one coupled change: never ship the gate-lift without the Apple button, or vice-versa.

---

## 2. Architecture

Two different mechanisms, by platform:

| Platform | Mechanism | Status |
|---|---|---|
| **iOS (native)** | Native `ASAuthorization` sheet via `@capacitor-community/apple-sign-in` → identityToken POSTed to a backend verify endpoint | ✅ P0 (this doc) |
| **Android / web / PWA** | The existing Spring OAuth2 server-side redirect, adding `apple` as a 3rd provider | ⏳ P1 (not built) |

The native plugin has **no Android support**, which is why Android/web stay on the redirect path.

### Native iOS flow (P0)

```
[Apple button] ──> SignInWithApple.authorize({ clientId=<bundleId>, scopes, nonce })
                        │  (native Face/Touch ID sheet; no browser, no redirect)
                        ▼
   { identityToken (RS256 JWT), authorizationCode, user(sub), email?, givenName?, familyName? }
                        │
                        ▼  POST /auth-service/learner/v1/oauth/apple/native
                           { identityToken, nonce, instituteId, email?, names?, ... }
                        ▼
   AppleIdentityTokenVerifier ── verify RS256 sig vs Apple JWKS, iss, aud∈bundleIds, exp
                        │
                        ▼  reuse the SAME token-minting as Google/GitHub
   LearnerOAuth2Manager.loginUserByEmail(name,email,instituteId,sub,"apple")
       └─ existing user → mint tokens │ new user → auto-signup per institute policy
                        ▼
   { accessToken, refreshToken }  ──(JSON body)──>  performFullAuthCycle()
                        ▼
   1 institute → /dashboard   │   2+ institutes → /institute-selection
```

Contrast with Google/GitHub on iOS, which open the system browser, complete a Spring OAuth2 redirect, and return tokens via an **Apple Universal Link** (`appUrlOpen` in `src/routes/__root.tsx`). The Apple native path needs **none** of that round-trip.

> **Audience note (the #1 Apple-Sign-In bug):** the id_token `aud` equals the **iOS bundle id** for the native flow (vs the **Services ID** for the future web flow). The verifier accepts a list of bundle ids.

---

## 3. Backend (`auth_service`)

### Endpoint

```
POST /auth-service/learner/v1/oauth/apple/native        (permit-all; under /learner/v1/**)
Body: { identityToken, authorizationCode?, user?, email?, givenName?, familyName?,
        fullName?, nonce?, instituteId (required), platform? }
200 : JwtResponseDto { accessToken, refreshToken }   — or { session_limit_exceeded, active_sessions }
4xx : ErrorInfo { ex: "<message>", ... }   (400 bad request / 401 auth failure)
```

### Files

| File | Role |
|---|---|
| `feature/auth/controller/AppleNativeAuthController.java` | Endpoint. Verifies token, resolves email/name, upserts the `apple` vendor mapping, reuses `LearnerOAuth2Manager.loginUserByEmail`. |
| `feature/auth/service/AppleIdentityTokenVerifier.java` | Verifies the Apple id_token. |
| `feature/auth/dto/AppleNativeLoginRequestDto.java` | Request body. |
| `resources/application-{stage,dev,k8s-local}.properties` | `apple.native.audiences` default. |

### Token verification (`AppleIdentityTokenVerifier`)

- **`NimbusJwtDecoder.withJwkSetUri("https://appleid.apple.com/auth/keys")`** — keys fetched & cached, key chosen by the token's `kid`.
- **Algorithm: RS256.** Apple signs id_tokens with RS256 (RSA). *(ES256 is only relevant to the P1 web client-secret — not here.)* `alg=none` / HS256-confusion are not possible.
- **Validators:** `JwtValidators.createDefaultWithIssuer("https://appleid.apple.com")` (signature + `iss` + `exp`/`nbf` timestamps) **plus** a custom audience validator.
- **Audience is fail-closed:** the token's `aud` must be in `apple.native.audiences`. If that list is empty (misconfig), **every** token is rejected — a `@PostConstruct` logs a loud warning.

### Account matching, linking & creation

User accounts are **email-keyed** (there is no `users.vendor_id` column), but the
controller resolves the email through the **stable Apple `sub`** first, so identity
is anchored to the Apple user, not a possibly-changing email string. Logic:

1. Take the email from the verified id_token (`email` claim), or the first-sign-in
   body field as a fallback.
2. **Recover by sub:** `getEmailByProviderIdAndSubject("apple", sub, email)` returns
   any email previously recorded for this Apple `sub` (and upserts the mapping). The
   recovered email wins when present.
3. `loginUserByEmail(name, recoveredOrCurrentEmail, instituteId, sub, "apple")`:
   - existing learner → deletes old refresh tokens, applies session-limit, mints tokens.
   - no learner → auto-signup per the institute's signup policy (unless `passwordStrategy=manual` or no policy → `null` → 401).

**Resulting linking policy:**

| Scenario | Outcome |
|---|---|
| Returning Apple user (real **or** relay email) | Recovered by `sub` → **same account** every time |
| First Apple sign-in, **real (shared)** email matching an existing account | Links to that account (**cross-provider** with a prior Google/email signup) |
| First Apple sign-in, **Hide-My-Email** relay address | No prior match → **new account**, bound to the `sub` for next time |

This mirrors the GitHub private-email handling in `CustomOAuth2SuccessHandler`. The
`(provider_id="apple", subject=sub, email)` row lives in `oauth2_vendor_to_user_detail`
(no DB migration — `provider_id` is a varchar). `is_private_email` is logged for support.

### Audiences config

Bundle ids are **public + static**, so they ship as the in-line **default** of the property — no k8s Secret, no CI change:

```properties
apple.native.audiences=${APPLE_NATIVE_AUDIENCES:io.vacademy.student.app,com.sevencs.learner,\
  io.ssdc.student.app,io.fivesep.student.app,io.shikshanation.app,io.enarkuplift.app,\
  io.chanakayaiasacademy.app,io.edzumo.app,io.sadbhavana.com}
```

To override at runtime (e.g. add a tenant without a rebuild), set `APPLE_NATIVE_AUDIENCES` — for prod that's a literal line in the `kubectl set env deployment/auth-service` step of `.github/workflows/maven-publish-auth-service.yml` (prod env is set imperatively there; there is no static k8s Secret YAML for that path).

> **Adding a new white-label iOS target** ⇒ add its bundle id to this property (and the Apple Developer App ID — see §6).

---

## 4. Frontend (`frontend-learner-dashboard-app`)

### Files

| File | Role |
|---|---|
| `src/lib/auth/appleNativeAuth.ts` | The whole native flow: plugin → POST → store tokens → `performFullAuthCycle` → navigate. Exports `isAppleNativeAvailable()`, `loginWithAppleNative()`, `AppleSessionLimitError`, `AppleSignInCancelledError`. |
| `src/components/common/auth/AppleSignInButton.tsx` | HIG-styled black button (phosphor `AppleLogo`). |
| `src/constants/urls.ts` | `LOGIN_URL_APPLE_NATIVE`. |
| `…/auth/login/forms/page/login-form.tsx` | Handler branch + Apple button + gate-lift. |
| `…/auth/login/components/modular/ModularDynamicLoginContainer.tsx` | Same. |
| `…/auth/signup/components/ModularDynamicSignupContainer.tsx` | Same (Apple is login-or-signup). |

### The three surfaces & the 4.8 gating rule

There are exactly **three** live OAuth UI surfaces (the `GoogleSignupProvider`/`GithubSignupProvider` files are dead mocks — not rendered). In each:

- Google / GitHub buttons render with **no `!isIOSNative()` guard** (gated only by their provider flag).
- The Apple button renders when **`isIOSNative() && (providers.google || providers.github)`** — i.e. **whenever a third-party social button appears on iOS, Apple appears too.** This is the 4.8 contract; there is no iOS state where Google/GitHub show without Apple.

### Behavior notes

- **Single vs multi institute:** the helper routes a learner with 2+ institutes to `/institute-selection` (mirrors the normal login flow); a single-institute learner goes straight to `/dashboard`.
- **User cancel:** dismissing the Apple sheet throws `AppleSignInCancelledError`, which all three handlers swallow silently (no scary toast).
- **instituteId:** taken from domain routing / URL / prop, with a fallback to the stored `Preferences["InstituteId"]`; the backend requires it.
- **Error messages:** the helper reads the backend's message from `body.ex` (the `ErrorInfo` field), so real reasons surface to the user.

---

## 5. iOS native config

All 8 iOS targets **share one entitlements file**, so one edit covers them:

- `ios/App/App/App.entitlements` →
  ```xml
  <key>com.apple.developer.applesignin</key>
  <array><string>Default</string></array>
  ```
- `ios/App/Podfile` → `pod 'CapacitorCommunityAppleSignIn', :path => '…/@capacitor-community/apple-sign-in'` inside the shared `capacitor_pods` def.
- **No Info.plist URL scheme** is needed for the native sheet (unlike Google). Deployment target 15.0 is fine (SIWA native since iOS 13).

> After pulling these changes, run **`npx cap sync ios && pod install`** on a Mac. `cap sync` will reconcile the Podfile line.

### Bundle ids (8 iOS targets)

`io.vacademy.student.app` · `com.sevencs.learner` · `io.ssdc.student.app` · `io.fivesep.student.app` · `io.shikshanation.app` · `io.enarkuplift.app` · `io.chanakayaiasacademy.app` · `io.edzumo.app`
(STEMx `io.stemx.app` is Android-only — no iOS target. `io.sadbhavana.com` is in the audiences list per ops.)

---

## 6. Apple Developer setup

**Required (done):** for **each** of the 8 App IDs, enable the **"Sign in with Apple"** capability (Identifiers → edit App ID), each as its **own primary** App ID (keep tenants ungrouped so every white-label has its own `sub` namespace). Signing fails for any target whose App ID lacks the capability, even though they share one entitlements file. On-device sign-in returns error 1000 if an App ID is not enabled.

**Not needed for native (P0):** no Services ID, no `.p8` key, no client-secret JWT. Those are only for the P1 web/Android redirect path.

---

## 7. Security model

**Verified server-side, per request:** RS256 signature against Apple's JWKS · `iss == https://appleid.apple.com` · `aud ∈ allowed bundle ids` (fail-closed) · `exp`/`nbf`. Email is taken from the **verified token**, never overridden by the request body.

**Nonce:** Apple echoes `request.nonce` **verbatim** into the id_token; the plugin forwards our raw nonce, so token-nonce == body-nonce. Because the nonce is **client-generated on both sides**, it adds **no real replay protection** — so the server **logs but does not reject** on mismatch (avoids ever falsely blocking a valid login). The real controls are signature + aud + exp. True single-use replay protection would need a **server-issued nonce** (tracked for P1).

---

## 8. Known limitations / deferred

- **P1 — Android & web Apple login** (redirect flow): a Spring `apple` `ClientRegistration` with a `.p8`-signed ES256 client-secret JWT (≤6-month rotation), `response_mode=form_post`, and `case "apple"` in `CustomOAuth2SuccessHandler`. Plus a Services ID + Key in the Apple portal. Not built.
- **Account-linking (implemented — see §3):** identity is anchored on the Apple `sub`, so returning users (incl. relay) are stable, real shared emails link cross-provider, and relay emails get their own account. The only deferred piece is an **in-app "merge accounts" UI** for a user who has both a relay-based Apple account and a separate Google/email account — there is currently no self-serve merge.
- **Apple Email Relay:** to email `@privaterelay.appleid.com` users, register sending domains in the Apple console. Skipped until needed.
- **Name returned once:** Apple sends `givenName`/`familyName`/`email` only on the **first** authorization; null thereafter. Persisted on first sign-in. To re-test, revoke under iOS Settings → Apple ID → Sign in with Apple.
- **HIG button glyph:** uses the phosphor `AppleLogo` (the repo design system mandates `@phosphor-icons/react`), not Apple's official asset — a minor review-cosmetics tradeoff.

---

## 9. Testing

- **Real device only.** Sign in with Apple is unreliable on the simulator — test on a physical device signed into a real Apple ID with 2FA.
- **First run vs subsequent:** name/email appear only on the first authorization. To repeat a first-run, revoke the app under iOS Settings → Apple ID → Sign in with Apple.
- **Backend smoke:** with a valid id_token for a configured bundle id, `POST /auth-service/learner/v1/oauth/apple/native` returns `{ accessToken, refreshToken }`; an id_token with a wrong `aud` returns 401.
- **4.8 visual check:** on iOS, the login & signup screens show Google, GitHub, **and** Apple together; tapping Apple opens the native sheet; cancelling shows no error.

---

## 10. Deep-review summary (2026-06-21)

A multi-agent adversarial review (backend security · frontend correctness · iOS/4.8 compliance) ran against P0. Outcome — all fixed:

| Sev | Finding | Resolution |
|---|---|---|
| ~~Critical~~ | "Nonce always mismatches (Apple hashes it)" | **False positive** — Apple echoes the nonce verbatim; raw==raw matches. The nonce check was made non-fatal anyway (see §7). |
| High | `application-stage.properties` had a broken line-continuation that corrupted the first audience (prod fail-closed). | Fixed — single valid line. |
| Medium | FE read `body.message`; backend returns `body.ex` → generic errors only. | FE now reads `body.ex`. |
| Medium | User-cancel showed a cryptic native error toast. | `AppleSignInCancelledError` swallowed in all 3 handlers. |
| Medium | Multi-institute learner dropped into one institute. | Routes to `/institute-selection`. |
| Low | Auth failures returned HTTP 510. | Use `VacademyException(BAD_REQUEST/UNAUTHORIZED, …)`. |
| Low | `instituteId` could be null before domain routing resolves. | Falls back to stored `Preferences["InstituteId"]`. |
| Low | No pending state on the modular Apple buttons. | `isAppleLoading` + `disabled`. |

**Verified correct by the review:** RS256 JWKS verification (no alg-confusion), `iss`/`exp` validation, fail-closed audience check, email-from-verified-token, the 4.8 gate-lift parity across all three surfaces (no other live social-render site), and the entitlement/per-target wiring.

---

## 11. File reference

**Backend:** `auth_service/.../feature/auth/{controller/AppleNativeAuthController,service/AppleIdentityTokenVerifier,dto/AppleNativeLoginRequestDto}.java`, `auth_service/src/main/resources/application-{stage,dev,k8s-local}.properties`
**Reused:** `auth_service/.../feature/auth/manager/LearnerOAuth2Manager.java`, `common_service/.../auth/service/OAuth2VendorToUserDetailService.java`, `auth_service/.../core/config/ApplicationSecurityConfig.java`
**Frontend:** `src/lib/auth/appleNativeAuth.ts`, `src/components/common/auth/AppleSignInButton.tsx`, `src/constants/urls.ts`, `src/components/common/auth/login/forms/page/login-form.tsx`, `…/login/components/modular/ModularDynamicLoginContainer.tsx`, `…/signup/components/ModularDynamicSignupContainer.tsx`
**iOS:** `ios/App/App/App.entitlements`, `ios/App/Podfile`
