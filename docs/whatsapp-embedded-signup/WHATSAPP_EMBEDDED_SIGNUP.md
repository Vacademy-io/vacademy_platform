# WhatsApp Embedded Signup — Design Doc

**Status:** Design locked 2026-07-17. Nothing built yet.
**Goal:** Let an institute connect (or create) their WhatsApp Business account from
`Settings > WhatsApp` in one Facebook popup — no Meta developer app, no system-user
token, no copy-pasting five credentials. The existing manual credential form **stays**
as a fallback/advanced path.

---

## 1. Where we are today

### Manual flow (kept)
Each institute currently must:
1. Create their **own** Meta developer app, add the WhatsApp product.
2. Create a system user in their Business portfolio, generate a permanent access token.
3. Copy Access Token / App ID / App Secret / Phone Number ID / WABA ID into
   `Settings > WhatsApp > Meta`.
4. Click "Re-register Webhook with META" (app-level `/subscriptions` + WABA
   `/subscribed_apps` Graph calls made server-side).

Credentials are stored (plaintext) in `institute.setting` JSON at
`WHATSAPP_SETTING.data.UTILITY_WHATSAPP.meta = { access_token, app_id, app_secret, phoneNumberId, wabaId }`,
managed by `InstituteWhatsAppSettingController` (`admin-core-service/institute/whatsapp-config/v1`).
Sending, templates and the inbox live in `notification_service` and read the same JSON.
Inbound webhooks route to the institute by `metadata.phone_number_id` via
`channel_to_institute_mapping`.

### Meta-side prerequisites (verified 2026-07-17)
- ✅ **Tech Provider verification** — Vidyayatan Technologies (Business ID `3845074555758114`)
  verified as Tech Provider; app **Vacademy Messaging** (App ID `1510916957164479`).
- 🟡 **App Review** — `whatsapp_business_messaging`, `whatsapp_business_management`,
  `public_profile` are drafted under "New requests" but **Not submitted**.
  Deliberate: Meta's review wants a screencast of the working integration, so we build
  Phase 1 in dev mode first (Embedded Signup works pre-review for users holding a role
  on the app), record the screencast, then submit.
- ❌ **Embedded Signup configuration** (Facebook Login for Business `config_id`) — not created yet.
- ❌ App-level WhatsApp webhook + JS SDK domain allowlist — not configured yet.

## 2. Target UX

`Settings > WhatsApp > Meta` card gains two modes:

- **"Connect with Facebook"** (primary, new) — opens Meta's Embedded Signup popup.
  The admin logs into Facebook, picks or **creates** a Business portfolio, picks or
  **creates** a WABA, adds a phone number and verifies it by SMS/voice OTP — all inside
  Meta's popup. On finish, Vacademy stores everything automatically and the provider
  card flips to Connected (number, display name, quality rating).
- **"Enter credentials manually"** (existing form, unchanged) — for institutes that
  already run their own Meta app or need a nonstandard setup.

Post-connect checklist card (things Embedded Signup does *not* do):
- Add a payment method to the WABA in WhatsApp Manager (required beyond the free tier).
- Complete Meta Business verification for higher messaging limits / display-name approval.

### White-label domains
Facebook's JS SDK only runs on domains allowlisted in the Meta app. Decision: Embedded
Signup launches **only on `dash.vacademy.io`**. White-label admins are hopped to
`dash.vacademy.io` for the connect step and returned to their origin afterwards — same
return-to-origin pattern already in prod for Meta Lead Ads (`OAuthRedirectResolver`).

## 3. Flow design

```
Institute admin (browser, dash.vacademy.io)          admin_core_service                    Meta Graph API
────────────────────────────────────────────         ─────────────────────────────         ──────────────
1. Click "Connect with Facebook"
2. FB.login({config_id, response_type:'code',
      override_default_response_type:true,
      extras:{sessionInfoVersion:'3', setup:{}}})
   → Meta popup: login → pick/create Business
     → pick/create WABA → add+verify phone
3. Receive:
   • auth `code` (FB.login response)
   • waba_id + phone_number_id
     (WA_EMBEDDED_SIGNUP postMessage, origin
      must be https://www.facebook.com)
4. POST /v1/whatsapp/embedded-signup/complete ───►  5. Exchange code ──────────────────►  GET /oauth/access_token
   {instituteId, code, wabaId, phoneNumberId}          (client_id, client_secret, code)      → business-integration
   (JWT: institute admin)                                                                     system-user token
                                                    6. Subscribe app to WABA ──────────►  POST /{waba_id}/subscribed_apps
                                                    7. Register number for Cloud API ──►  POST /{phone_number_id}/register
                                                       (messaging_product, 6-digit pin        {pin}
                                                        we generate & persist)
                                                    8. Sanity read ────────────────────►  GET /{phone_number_id}
                                                                                            ?fields=verified_name,
                                                                                             display_phone_number,
                                                                                             quality_rating
                                                    9. Persist (see §5), upsert
                                                       channel_to_institute_mapping,
                                                       set provider=META, evict caches
                                                    10. Return status ◄──
11. Card shows Connected; if white-label,
    redirect back to original origin
```

Notes:
- Step 5's token is a **business-integration system-user access token** scoped to the
  client's WABA. In the Embedded Signup configuration choose the **never-expiring**
  token option (verify at build time; the alternative is 60-day + refresh job à la
  `MetaTokenRefreshJob`).
- Step 7 (`/register`) requires a 6-digit two-step-verification PIN. We generate one per
  institute, send it in the register call, and persist it alongside the credentials —
  needed again if the number is ever re-registered. If the number already has a PIN set
  (migrated number), registration fails with a specific error; surface it and let the
  admin enter their existing PIN.
- No app-level `/{app_id}/subscriptions` call per institute (that's how the manual flow
  works today). With one shared app, the callback URL is configured **once** in the App
  Dashboard; per-institute wiring is only `subscribed_apps` + channel mapping.
- Pin all new code to one Graph version (v22.0 to match the WhatsApp senders; check
  current stable at build time and consider bumping everything, incl. Lead Ads on v21.0).

## 4. Backend (admin_core_service)

New controller `MetaWhatsAppSignupController` under
`/admin-core-service/v1/whatsapp/embedded-signup`:

| Endpoint | Purpose |
|---|---|
| `POST /complete` | Body `{instituteId, code, wabaId, phoneNumberId}`. Does steps 5–10. Idempotent per institute (re-connect overwrites). |
| `GET /status?instituteId=` | Connection health: token valid (`GET /debug_token` or lightweight WABA read), subscribed, number registered, quality rating, display-name status. |
| `POST /initiate?instituteId=&frontendOrigin=` | Only for the white-label hop (Phase 2): mints a short-lived state row so the dash-domain page knows where to return. Reuses `oauth_connect_state` (new vendor `META_WHATSAPP_ES`). |

Why admin_core (not notification_service): reuses `TokenEncryptionService`
(AES-256-GCM), `oauth_connect_state`, `OAuthRedirectResolver`, and the Meta config
plumbing from the Lead Ads OAuth flow; and the credential store it writes
(`institute.setting`) already lives in admin_core.

Config (new env vars — distinct from Lead Ads' `META_APP_ID` so the two apps can differ):

```
meta.whatsapp.es.app.id=${META_WA_APP_ID:1510916957164479}
meta.whatsapp.es.app.secret=${META_WA_APP_SECRET:}
meta.whatsapp.es.config.id=${META_WA_ES_CONFIG_ID:}
meta.whatsapp.webhook.verify.token=${META_WA_WEBHOOK_VERIFY_TOKEN:}   # also read by notification_service
```

## 5. Data model

Write into the **same** credential shape the manual flow uses, so every downstream
consumer (sender, template manager, inbox, webhook router) works unchanged:

```jsonc
"UTILITY_WHATSAPP": {
  "provider": "META",
  "meta": {
    "access_token": "<business token>",
    "app_id": "1510916957164479",        // our shared app
    "app_secret": "",                     // intentionally blank — never store our app secret per-institute
    "phoneNumberId": "...",
    "wabaId": "...",
    "connected_via": "EMBEDDED_SIGNUP",  // vs implicit MANUAL
    "two_step_pin": "...",
    "connected_at": "2026-07-17T...Z"
  }
}
```

- `app_secret` blank per-institute: anything needing the app secret (signature checks,
  app access token) reads it from env when `connected_via=EMBEDDED_SIGNUP` /
  `app_id == META_WA_APP_ID`.
- Security debt (pre-existing): this JSON is plaintext. Phase 2 item: encrypt
  `access_token` with `TokenEncryptionService` and give notification_service the
  `OAUTH_TOKEN_ENCRYPTION_KEY` + a small decrypt util. Not a Phase 1 blocker because
  the manual flow already stores plaintext tokens.

## 6. Webhooks — one URL, plus three pre-existing bugs to fix

With Embedded Signup all client WABAs deliver to the **app-level callback** configured
once in App Dashboard → WhatsApp → Configuration:

- Callback URL: `https://backend-stage.vacademy.io/notification-service/webhook/v1/meta`
  (the path that actually exists — see bug 1)
- Verify token: `META_WA_WEBHOOK_VERIFY_TOKEN`
- Subscribed fields: `messages`, `message_template_status_update`, `account_update`,
  `phone_number_quality_update`

Routing by `phone_number_id → channel_to_institute_mapping` already works;
`/complete` creates the mapping automatically.

**Bugs to fix (P0, ship with Phase 1):**
1. **Webhook URL mismatch** — the UI shows/registers
   `/notification-service/v1/webhook/whatsapp`, but the real controller is
   `MetaWebhookController` at `/notification-service/webhook/v1/meta`. Fix the FE
   constant + `registerMetaWebhook` default, and audit existing manual institutes whose
   own apps may have the dead URL registered as their callback.
2. **`hub.verify_token` not validated** on the GET challenge (TODO in
   `MetaWebhookController`) — validate against `META_WA_WEBHOOK_VERIFY_TOKEN`.
3. **`X-Hub-Signature-256` verification is a stub** (`MetaWebhookHandler.verifySignature`
   returns `true`). Copy the working HMAC-SHA256 impl from `MetaLeadAdsStrategy`.
   Secret resolution: parse the (unverified) body just enough to get `phone_number_id`
   → institute → secret = env app secret for ES institutes, stored `app_secret` for
   manual ones; then verify over the raw body before trusting the payload.

Cleanup while in there: `WhatsAppProviderFactory.extractMetaCredentials` maps
`phoneNumberId` from `meta.appId` **first** — quirky precedence that will bite the
shared-app world where `app_id` is never a phone number id. Fix the precedence.

**Bonus unlocked:** `message_template_status_update` events mean template
APPROVED/REJECTED status can update in real time (today it's pull-only `/sync`).

## 7. Frontend (frontend-admin-dashboard)

- `WhatsAppSettings.tsx` META card: add **Connect with Facebook** button + connected
  summary panel (display number, verified name, quality rating from `/status`);
  keep the manual credentials form behind "Enter credentials manually".
- New hook/util loading the FB JS SDK (only on this page, `dash.vacademy.io` build),
  launching `FB.login` with the config, listening for the `WA_EMBEDDED_SIGNUP`
  postMessage (validate `event.origin === 'https://www.facebook.com'`), then calling
  `POST /embedded-signup/complete`.
- `WebhookSetup.tsx`: for `connected_via=EMBEDDED_SIGNUP`, collapse to a status line
  ("Webhook managed by Vacademy — connected ✓" + re-subscribe button that re-runs
  `subscribed_apps`); fix the displayed webhook URL constant (bug 1) for manual mode.
- Post-connect checklist card (payment method, business verification).
- Phase 2: white-label hop — non-`vacademy.io` origins get a "Continue on
  dash.vacademy.io" interstitial that round-trips via `/initiate`'s state row.

## 8. Meta dashboard checklist (your side — do in this order)

On [developers.facebook.com](https://developers.facebook.com) → Vacademy Messaging (`1510916957164479`):

1. **WhatsApp product** — appears already added (permissions are drafted). Confirm it
   shows under Products.
2. **Add "Facebook Login for Business"** product → **Configurations** → Create
   configuration → choose the **WhatsApp Embedded Signup** template → login variant
   *General*, token type *Business integration system user*, token expiry **Never**,
   assets: WhatsApp Business Accounts + phone numbers, permissions
   `whatsapp_business_management`, `whatsapp_business_messaging`.
   → **Send me the resulting `config_id`.**
3. **App settings → Basic**: add App Domain `dash.vacademy.io`; set a Website platform
   URL; privacy policy URL + app icon + category (App Review checks these).
4. **Facebook Login for Business → Settings**: add `https://dash.vacademy.io/` to
   *Allowed Domains for the JavaScript SDK*; enable *Login with the JavaScript SDK*.
5. **WhatsApp → Configuration → Webhook**: callback URL
   `https://backend-stage.vacademy.io/notification-service/webhook/v1/meta`, verify
   token = the value we'll set as `META_WA_WEBHOOK_VERIFY_TOKEN` (generate a random
   one; needs backend bug-fix 2 deployed first, since today the GET ignores the token —
   it will still pass, but set it correctly from day one). Subscribe to fields listed in §6.
6. **Send me**: `config_id`, the app secret (as env var material, not in chat if you
   prefer — drop it straight into the k8s secret), chosen verify token.
7. **Do NOT submit App Review yet.** Build + test in dev mode (works for app
   admins/developers/testers — add the team + a test institute's FB account as testers),
   record the screencast of: popup → WABA creation → message send → inbound reply.
   Then submit the drafted `whatsapp_business_messaging` + `whatsapp_business_management`
   + `public_profile` requests with the screencast. After approval, switch app to
   **Live mode** — that's the moment self-serve opens to all institutes.

What clients need (no Meta dashboard work for them): a Facebook login, a phone number
that can receive an OTP and isn't active on consumer/Business-app WhatsApp (or they
accept migrating it), and a card on file in WhatsApp Manager for paid conversations.

## 9. Phases

- **Phase 0 (you + me, no deploy):** checklist §8 items 1–6; add the four env vars to
  admin_core + notification_service deployments.
- **Phase 1 (build, works in dev mode):** `/complete` + `/status` endpoints, FE Connect
  button + connected panel, webhook bug fixes 1–3, provider-factory precedence fix.
  Test end-to-end with a tester account; record App Review screencast; submit review.
- **Phase 2 (after review approval / Live mode):** white-label hop via `/initiate`,
  token/connection health job (reuse `MetaConnectorMonitorJob` pattern — tokens die when
  a client removes the app in Business settings), template-status webhook ingestion,
  token encryption at rest, post-connect checklist card polish.

## 10. Risks / open items

- **App Review outcome** — Meta may ask for changes to the screencast or use-case text;
  budget a retry cycle. Dev-mode testing is unaffected meanwhile.
- **Never-expiring token option** — confirm it's still offered in the ES configuration
  UI at build time; otherwise implement 60-day refresh (infra exists from Lead Ads).
- **Numbers already on WhatsApp** — migration from the consumer/Business app deletes
  chat history and has a cooldown; the UI copy must warn before the popup.
- **Existing manual institutes** — untouched. Optional later: "switch to Vacademy-managed
  connection" migration that re-runs ES on their existing WABA (Meta supports selecting
  an existing WABA in the popup).
- **Rate/messaging limits** — new WABAs start at the lowest business-initiated tier
  until Meta business verification; set expectations in the post-connect checklist.
