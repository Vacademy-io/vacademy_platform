# Zoom Onboarding — Friction-Reduction Design (Connect-with-Zoom + per-institute SDK)

**Status:** Proposed · **Branch:** `feat/zoomIntegration` · **Author:** generated for review

## 1. Goal & hard constraints

**Goal:** reduce Zoom onboarding friction. Today an institute admin must create **two** Zoom Marketplace apps (a Server-to-Server OAuth app *and* a Meeting SDK app, in the same Zoom account) and paste **five** secrets (Account ID, S2S Client ID, S2S Client Secret, SDK Client Key, SDK Client Secret).

Two **hard constraints** bound every option below — both come from Zoom's own model, verified against the docs:

- **C1 — Anonymous learner joins must be *same-account* as the meeting.** As of Zoom's Feb/Mar 2026 enforcement, an SDK app joining a meeting owned by a *different* account must send an attribution token (ZAK/OBF/RTMS); plain-JWT cross-account joins fail. Anonymous learners have no clean attribution token (ZAK needs a real Zoom user; OBF is single-user/bot-scoped). ⇒ **the Meeting SDK app must live in the institute's own Zoom account** (where the meeting also lives) so learner joins stay same-account and exempt. → *SDK app stays per-institute.*
- **C2 — Server automation needs account-level capability.** Creating meetings for *any* teacher and minting *any* teacher's host **ZAK** (`GET /users/{userId}/token?type=zak`) requires passing a real `userId`. **User-level OAuth is locked to `userId=me`** and cannot do this. Only **account-level OAuth** (`meeting:write:admin`, `user:read:admin`, `recording:read:admin`) **or S2S** can. → *the API/ZAK backbone must be S2S or account-level OAuth, never user-level OAuth.*

## 2. Key decisions

### Decision 1 — Meeting SDK app stays **per-institute** (default)
Driven by **C1**. A platform-owned SDK app would make every learner join cross-account and break the anonymous-learner path under the 2026 rule. We still implement a **config-gated platform-SDK resolver** (below) as a *capability* — but it is **host-only / same-account safe**, not the learner-join default.
> Upside scenario to re-evaluate: if Zoom exposes a supported anonymous-guest cross-account join path, platform-SDK becomes viable and the per-institute SDK app could be dropped. Tracked as a verification item (§6).

### Decision 2 — "Connect with Zoom" = **account-level OAuth**, layered on top of S2S (not replacing it)
Driven by **C2** + the Marketplace/operational tax:
- **Capability:** account-level OAuth has full parity with S2S (arbitrary-host meeting creation, arbitrary-host ZAK, all-user recordings). User-level OAuth does **not** — it's `me`-only.
- **Cost of account-level OAuth:** (a) the institute's Zoom **admin** must authorize (admin role required); (b) **90-day refresh token that rotates on every refresh** must be persisted per tenant; (c) **Zoom Marketplace publishing + security review** is mandatory to onboard external accounts in production (private app = own-account only; beta external sharing caps at **10** accounts and the auth URL expires in 4 weeks).
- **Therefore:** keep **S2S as the zero-dependency capability backbone and fallback** (no Marketplace, no refresh tokens, already does everything), and add **account-level "Connect with Zoom"** as the polished onboarding path, **gated on the published Marketplace app**. The two coexist; CRUD/paste flow is never removed.

### What the end-state onboarding looks like
| | Status quo (today) | With Connect-with-Zoom |
|---|---|---|
| API / ZAK / recordings | S2S app (admin creates) + paste 3 fields | **Click "Connect with Zoom" → admin authorizes** (0 fields) |
| Learner-join SDK | SDK app (admin creates) + paste 2 fields | SDK app (admin creates) + paste 2 fields *(unchanged — C1)* |
| Webhook | optional token | optional token |
| Net | 2 apps, 5 fields | 1 app, 2 fields, 1 click |

Connect-with-Zoom removes the S2S app + its 3 fields. The **per-institute SDK app + 2 fields remain** because of C1 — that's the floor until/unless the anonymous cross-account join question (§6) resolves.

## 3. Phased implementation plan

All changes are **additive and backward-compatible** — existing S2S accounts keep working untouched (the token path branches on auth-type, defaulting to S2S).

### Phase 1 — Optional platform-SDK resolver + SDK fields optional *(smallest; no external dependency)*
Lets an account be registered without SDK creds and lets a configured platform SDK app sign signatures (host-only/same-account safe — **not** enabled as the learner default).
- `ZoomSdkSignatureService.java` — inject `@Value("${zoom.sdk.client-id:}")` / `@Value("${zoom.sdk.client-secret:}")` (~line 39); in `buildSignature` (49-50) and `getSdkKey` (77-79), **prefer the per-account SDK fields, fall back to the platform `@Value`s** when blank.
- `ZoomAccountService.create` — relax `requireSecret(req.getSdkClientSecret(), …)` (line 61). `ZoomAccountRequest` — drop `@NotBlank` on `sdkClientKey` (36-37). SDK fields become optional.
- `application.properties` (near the Meta block ~L90) — add `zoom.sdk.client-id=${ZOOM_SDK_CLIENT_ID:}` and `zoom.sdk.client-secret=${ZOOM_SDK_CLIENT_SECRET:}`.
- FE `AddZoomAccountDialog.tsx` — make `sdkClientKey`/`sdkClientSecret` optional in `createSchema` (48-57) + `sanitize` (388-408); update copy. `zoom-accounts.ts` — drop them from `ZoomAccountRequest`. `ZoomAccountList.tsx` — drop the masked-SDK chip.
- ⚠️ Document clearly: platform-SDK resolver is **host-only / same-account**; do not enable it as the default for institutes whose learners join (C1).

### Phase 2 — "Connect with Zoom" backend (account-level OAuth) *(+ start Marketplace review in parallel — long lead)*
Mirror the **existing in-repo OAuth patterns** — Zoho (code→token + refresh) and Meta (browser OAuth controller + state store + refresh job):
- **`ZoomOAuthController`** (new, package `…provider.controller.zoom`) — `POST /oauth/initiate` builds the authorize URL + creates an `OAuthConnectState(vendor=ZOOM_OAUTH)` (reuse `OAuthConnectState` / `OAuthConnectStateRepository` as the CSRF/state store, exactly like `MetaOAuthController.initiate`); **public** `GET /oauth/callback` exchanges `code` → tokens against `ZoomEndpoints.OAUTH_TOKEN_URL` (`grant_type=authorization_code`) and redirects the browser back to `/settings?selectedTab=integrations`.
- **Token storage** — extend `ZoomAccount` + `ZoomAccountStore.writeConfig`/`toAccount` with `oauthAccessTokenEnc`, `oauthRefreshTokenEnc`, `oauthTokenExpiresAt` (AES-GCM via the already-injected `TokenEncryptionService`); no schema change (lives in the provider-mapping `config_json`).
- **Token use** — branch `ZoomAccessTokenService.getAccessToken` (44-58) on auth-type: OAuth accounts **refresh-if-near-expiry** (mirror `ZohoOAuthService.getValidConfigMap`/`refreshAccessToken`, 300s buffer) and **persist the rotated refresh token** each time; S2S accounts keep `account_credentials`. `getZakToken` is unchanged (works for both).
- **`ZoomTokenRefreshJob`** (new, `provider/scheduler/`) — `@Scheduled` proactive refresh, mirroring `MetaTokenRefreshJob`.
- **Security** — add the public `/oauth/callback` path to `ApplicationSecurityConfig` permitAll (mirror the Meta callback entry).
- `ZoomEndpoints` — add `OAUTH_AUTHORIZE_URL = https://zoom.us/oauth/authorize`.
- **Scopes to request (account-level):** `meeting:write:admin`, `user:read:admin`, `recording:read:admin` (+ webhook/event subscriptions as needed). Expect Zoom security review to scrutinize `:admin` scopes.
- **External, parallel:** register the **account-level** Marketplace app, configure redirect URI, and submit for **publishing + security review** (this gates real multi-tenant production; ~weeks of lead time).

### Phase 3 — "Connect with Zoom" frontend
- `ZoomIntegrationCard.tsx` — add a **"Connect with Zoom"** button next to "Add Zoom account" (72-81) that calls a new `initiateZoomOAuth()` in `zoom-accounts.ts` and `window.location = oauth_url` (mirror Meta initiate). Add `ZOOM_OAUTH_BASE` to `constants/urls.ts`.
- Keep the **paste form as a fallback** (for self-hosted/internal tenants on S2S, and before the Marketplace app is published).

## 4. External dependencies / gotchas
- **Marketplace publishing + security review** is the critical-path long-lead item for account-level OAuth (Phase 2/3 can't go multi-tenant-production without it). Private account-level apps cap at 10 added accounts.
- **Refresh-token rotation**: every refresh returns a *new* refresh token; persist it or the tenant disconnects after the 90-day window.
- **Admin authorization**: the institute's authorizing user must hold the admin role permissions matching the `:admin` scopes.
- **Licensing stays per-institute**: meeting limits/minutes accrue on the institute's own Zoom account (host must be Pro+ for full-length meetings) — unaffected by onboarding method.

## 5. Backward compatibility
Every change is additive. Existing S2S accounts: untouched (auth-type defaults to S2S). Existing per-account SDK secrets: keep working via the Phase-1 fallback (no data migration). Paste form + CRUD: retained.

## 6. Verification items (resolve before relying on the affected path)
1. **Anonymous-guest cross-account SDK join** — can an anonymous learner join a meeting owned by a *different* account via the SDK at all post-enforcement? If **yes**, platform-SDK (Decision 1) could later drop the per-institute SDK app; if **no**, per-institute SDK is permanent. *Decision pivot.*
2. **Web SDK version** — current FE uses Web Meeting SDK `3.13.2`; confirm the version/attribution requirements if cross-account is ever pursued (research cited MSDK ≥ 5.17.5 — different versioning scheme; pin down).
3. Confirm Zoom security review accepts the `:admin` scope set for the published app.

## 7. Sources
- Decisions grounded in: Zoom Meeting SDK auth (`developers.zoom.us/docs/meeting-sdk/auth/`), OBF transition (`/blog/transition-to-obf-token-meetingsdk-apps/`), OAuth + scopes (`/docs/integrations/oauth/`, `/docs/integrations/oauth-scopes`), "Using Zoom APIs" `me`-rule (`/docs/api/using-zoom-apis/`), app distribution/review (`/docs/distribute/...`, `/docs/integrations/create/`), S2S (`/docs/internal-apps/s2s-oauth/`).
- Code change-surface verified on `feat/zoomIntegration` (see file:line references inline).
