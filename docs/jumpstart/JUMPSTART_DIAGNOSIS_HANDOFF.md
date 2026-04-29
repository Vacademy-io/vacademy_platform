# Jumpstart 14-Day & FB Lead Journey — Diagnosis Handoff

> **Purpose:** Handoff brief from a database-trace session that root-caused why WhatsApp messages aren't being delivered for the Jumpstart 14-day challenge and the FB lead 7-day journey. Findings are evidence-backed with `notification_log` / `workflow_execution_log` data, not just code reading.
>
> **Scope:** `institute_id = 757d50c5-4e0a-4758-9fc6-ee62479df549`

---

## TL;DR

| What the user observes | Real cause |
|---|---|
| Day 0 Welcome (`new_day_0_template`) delivers | Works as designed (event-driven, no filter) |
| Day 1 Welcome (`days_1_js_new`) doesn't deliver | **Bug 5** — template broken at WATI/Meta since 2026-04-07 (100% failure for 19 days, ~255 lost sends) |
| Day 2 generic (`day_2_11_days_jss_utility`) delivers | Works (`day_2_workflow`, no filter) |
| Day 1–11 challenge content per level (`little_win_day_*_level_*`) — never delivers | **Bug 2**: TRANSFORM uses a selection filter (`?.?[ ]`) that drops ~98.5% of leads (Bug 1 was a false alarm — backend-stage.vacademy.io IS prod URL) |
| Day 1–11 PM messages (`little_win_day_*_pm`) — never delivers | Same as above (Bug 2 only) |
| Day 5 catch-up (`catch_up_little_win_day_5`) delivers | Calls the same broken HTTP, but its TRANSFORM uses **projection** (`.![ ]`) — filter result is dead code, sends to all leads |
| Some sends fail at WATI ("Missing customer attributes") | **Bug 3** — WATI contact missing `allowcampaigns` / `attribute_*` |
| Some sends fail at WATI/Meta ("Message undeliverable") | Per-lead phone-not-on-WhatsApp; out of Jumpstart scope |
| FB Day 4 / Day 6 always fail | **Bug 6** — SpEL key casing + missing `fb name` field |
| FB sends fail when phone has `+` prefix | **Bug 7** — webhook doesn't normalize phone |
| Day 4 Level 2 sent 3× | **Bug 8** — duplicate ACTIVE workflows |

---

## Verified architecture

### Lead capture (Phase 1)

```
Form (Zoho or FB)
    ↓ POST /admin-core-service/api/v1/audience/webhook/form (X-Vendor-ID header)
form_webhook_connector            -- resolves audience_id from vendor_id
    ↓ applies sample_map_json     -- form key  →  system field name
    ↓ applies default_values_json -- center constants (FB only)
audience_response (minimal — only IDs + workflow_activate_day_at populated)
    ↓ one row per field
custom_field_values (source_type='AUDIENCE_RESPONSE', source_id=response.id)
```

Notes:

- **`audience_response.parent_name` / `parent_email` / `parent_mobile` columns are unused.** All lead identity lives in `custom_field_values`. Workflows read from there.
- **`custom_fields` is global** with institute-namespaced `field_key` (e.g. `parent_name_inst_<institute>`). The same `field_id` is reused across all 13 Jumpstart center audiences via `institute_custom_fields(type='AUDIENCE_FORM', type_id=<audience_id>)`.
- **`system_field_custom_field_mapping` is empty for the institute.** The doc claims it's the indirection layer; in reality the system writes `custom_field_values` rows by direct field-name match against `custom_fields` attached to the audience.
- **Zoho `sample_map_json` is thin** (only 3 keys: `Email`, `Primary Email`, `Full Name`). Other form fields land in `custom_field_values` via an undocumented "auto-map by name" fallback in `FormWebhookService`. Verified — all 10+ fields land correctly for Zoho leads (parent name, phone, dob, etc.).
- **FB `default_values_json` injects center constants** (`center name`, `Schedule Link`, `Location Link`, `School Phone`, `FB Name`) at webhook time so a single audience (`Facebook Leads New`) can fan out to 11 centers.

### Workflow engine (Phase 2)

There are **two parallel tracks**, with different gating mechanics:

| Track | Workflows | Nodes | Filter? | Status |
|---|---|---|---|---|
| Day-0 / Day-N generic | `wf_audience_email_01`, `day_1_workflow`, `day_1_workflow_2` (Referral), `day_2_workflow` | QUERY → TRANSFORM → SEND_WHATSAPP | none | Works (provided template is OK at WATI) |
| Day-N level / PM / catch-up | `little_win_day_X_level_{1,2,3}`, `little_win_day_X_pm`, `little_win_day_5_level_1_catch_up`, `little_win_day_3_bonus`, `js_certificate`, `2_day_inactivity_workflow` | HTTP_REQUEST → QUERY → TRANSFORM → SEND_WHATSAPP | depends on TRANSFORM operator | Mostly broken |

The HTTP_REQUEST node calls `filter-adjacent-sequence` on the notification-service. The TRANSFORM either filters by it (selection `?.?[ ]`) or ignores it (projection `.![ ]`). The choice of operator is what makes the difference.

### Lead capture vs delivery scope

| Audience | ID | Lead count (30d, as of 2026-04-27) |
|---|---|---|
| Wakad | `cc8e2535-5e5a-49a2-82f3-312afc4ed6c7` | 68 |
| Magarpatta | `6b3cb024-aa14-4226-a485-18c50e4c39b3` | 56 |
| Nyati Country | `48995e06-476f-42e0-8dad-3b27b2d996dc` | 46 |
| Karve Road | `84454ecf-d40b-4216-b4aa-01feb2c1df3f` | 43 |
| Hinjewadi | `8bcb8aaa-5477-488a-98a8-1cc4d2a331a9` | 37 |
| Referral Invite | `938f447a-d0a7-4219-b101-863b25272654` | 35 (offset_day=-1) |
| Koramangala | `7ae98465-4faa-47b9-aa0e-3edf6b97f205` | 24 |
| Baner | `58f17610-ec22-42f7-8782-1cf02af8f45c` | 21 |
| Bibwewadi | `7125ee0e-85f7-4475-a845-409421793df2` | 20 |
| Pimple Saudagar | `1333ddb7-33e0-4451-9b62-efd9fc5bf838` | 19 |
| Viman Nagar | `09f6d308-bed4-454b-8a70-e95a66c0cffd` | 15 |
| Facebook Leads New | `61b4cd61-a0aa-4b93-9af6-b717a951c5f5` | 13 |
| Pashan, Kalyani Nagar | (audiences exist, 0 leads) | 0 |

---

## Bug list with evidence

### Bug 1 — ~~53 HTTP nodes hardcoded to staging URL~~ NOT A BUG ✓ RESOLVED

**Confirmed 2026-04-29:** `backend-stage.vacademy.io` IS the production backend URL for this setup. There is no separate production domain. The HTTP_REQUEST nodes are pointing at the correct server. Do NOT replace this URL.

### Bug 2 — Level/PM TRANSFORM filter drops 98.5% of leads

**Symptom:** Even with the URL fixed, the level/PM TRANSFORM expression filters every lead out unless their `userId` appears in the HTTP response body. The filter is fed by a downstream filter that requires users to have replied with the EXACT literal string `LEVEL 1 (<2 YEARS)`, `LEVEL 2 (2-4 YEARS)`, or `LEVEL 3 (>4 YEARS)`.

**Evidence (notification_service):**
```
LEVEL 2 (2-4 YEARS) — 10 messages, 10 distinct users
LEVEL 1 (<2 YEARS)  —  7 messages,  4 distinct users
LEVEL 3 (>4 YEARS)  —  2 messages,  2 distinct users
```
Across 3 months, **only 16 distinct users** out of ~1,100 leads (≈ 1.5%) ever produced the literal level reply.

**Spel difference:**
- Level/PM: `#ctx['leads']?.?[ #ctx['valid_sequence_users']?.body?.contains(#this['userId']) ]?.![ ... ]` — selection
- Catch-up: `#ctx['leads'].![ ... ]` — projection (filter result ignored)

The catch-up workflow proves a no-filter design works. The level workflows should follow that pattern (with the caveat in Fix 2 below about avoiding triple sends).

### Bug 3 — WATI "Missing customer attributes"

**Symptom:** Even sends that pass the workflow filter sometimes fail at WATI with "Missing customer attributes — check contact information". Visible per-lead in WATI dashboard.

**Likely cause:** WATI requires `allowcampaigns: true` and any referenced `attribute_N` fields to be set on the contact. The Vacademy → WATI integration probably doesn't set them when creating contacts.

**Where to look in code:** `notification_service` WATI sender / contact-creation flow. Need to confirm what attributes are passed when a new contact is upserted.

### Bug 4 — "Message undeliverable" (per-lead, out of scope)

**Symptom:** Some sends fail with WATI's "Message undeliverable" tooltip. Phone is most likely not a WhatsApp account (typo, landline, deleted account).

**Confirmed not from Jumpstart workflow engine** — sample case (Adhip Patil / Aayansh Patil) does not exist in `audience_response` / `custom_field_values` for this institute. The message is being sent from a different system (manual WATI broadcast, separate CRM, etc.).

**Fix at form intake** — validate WhatsApp-format phones at submission time. Workflow engine doesn't need changes.

### Bug 5 — `days_1_js_new` template 100% failing since 2026-04-07

**Symptom:** Day 1 Welcome template fails at WATI. Working April 6, partially failing April 7, 100% failure April 8 onwards.

**Evidence (notification_log success/fail by date):**
```
Apr 06:  2 success,  0 failed   ← clean
Apr 07:  7 success, 22 failed   ← regression starts
Apr 08+: 0 success, 100% failed (255 lost sends across 19 days)
```

**Likely cause:** Template was edited or paused in Meta Business Manager / WATI on April 7, dropped to PENDING/REJECTED, and every send since fails. Could also be a button URL (`/m/js1a/{phone}`) host going dark.

**Fix in WATI/Meta dashboard, not the DB.** Check template status, re-approve if needed. May also be the user has already fixed this — confirm before next chat assumes it's still broken.

### Bug 6 — FB Day 4 / Day 6 SpEL key mismatches

**Symptom:** FB lead journey Day 4 and Day 6 messages always fail.

**Evidence:** [fb_leads_workflow_config.sql:197](fb_leads_workflow_config.sql#L197) and [:267](fb_leads_workflow_config.sql#L267) reference `'fb name'`, `'location link'`, `'school phone'` (all lowercase). Stored field names are `Location Link`, `School Phone`, and `PM Name` (capitalized). And the connector pushes `"FB Name"` not `"PM Name"`, so `'fb name'` matches nothing either way.

**Fix:** rename connector key `"FB Name"` → `"PM Name"` in all 11 FB connectors (or rename the audience field), and fix lowercase keys in Day 4/6 SEND_WHATSAPP TRANSFORM SpEL.

### Bug 7 — Phone with `+` prefix rejected by WATI

**Symptom:** FB lead Day 2 send for `+917999873846` failed at WATI; same number without `+` succeeds elsewhere.

**Evidence:** `workflow_execution_log` for `fb_lead_journey_day_2` on 2026-04-24 09:00 shows `failureCount: 2` with `mobileNumber: "+917999873846"`. Same phone in `notification_log` for other templates uses `channel_id = 917999873846` (no `+`) and succeeds.

**Fix:** strip leading `+` in the form-webhook ingest path before writing to `custom_field_values`. Phone normalization is inconsistent across send paths.

### Bug 8 — Triple-active duplicate workflows

**Symptom:** "Js Challenge day 4 level 2" exists 4 times: 3 ACTIVE (`little_win_day_4_level_2`, `b7cea079-…`, `6c251574-…`) + 1 DRAFT (`aec53df0-…`). All three ACTIVE ones have full 4-node configs. Once Bug 1 + 2 are fixed, every Day-4 Level-2 lead will receive the same message 3 times.

**Fix:** deactivate `b7cea079-…` and `6c251574-…`, leave only `little_win_day_4_level_2`.

### Other smells (low-priority)

- `challenge_day_2` workflow exists with 0 nodes, ACTIVE. Orphan; safe to delete or set status `DELETED`.
- `Js Challenge day 1 level 1` has one stale INACTIVE schedule (last updated 2026-01-15) alongside the working ACTIVE one. Cleanup.
- Pashan and Kalyani Nagar audiences have 0 leads (centers not yet active or webhook misconfigured at Zoho). Worth confirming with ops.

---

## Fix plan (priority order)

### 1. Confirm prod vs staging (BLOCKING)
Run a known-prod-only check (e.g. count of recent leads). Don't proceed with Bug 1 UPDATE until this is confirmed. If staging, the stage URL is correct and Bug 1 isn't a bug.

### 2. Bug 5 — `days_1_js_new` (5-min ops fix)
Open WATI and Meta Business Manager. Check template status. Re-approve if rejected, or fix button URL host if broken.

Verification:
```sql
-- on notification_service
SELECT DATE(notification_date) AS day,
       COUNT(*) FILTER (WHERE body LIKE '%Status: SUCCESS%') AS success,
       COUNT(*) FILTER (WHERE body LIKE '%Status: FAILED%')  AS failed
FROM notification_log
WHERE source_id = 'days_1_js_new'
  AND notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
  AND notification_date >= NOW() - INTERVAL '2 days'
GROUP BY DATE(notification_date)
ORDER BY day DESC;
```

### 3. Bugs 1 + 2 — restore challenge content delivery (deploy together)

**Don't deploy Bug 1's URL fix in isolation** — it does ~nothing because Bug 2 still drops every lead.

#### Bug 1 (URL UPDATE — admin_core_service)
```sql
-- Verify count first
SELECT COUNT(*) FROM node_template
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND node_type = 'HTTP_REQUEST'
  AND config_json LIKE '%backend-stage.vacademy.io%';
-- Expected: 53

-- Optional backup
CREATE TABLE node_template_backup_2026_04_28 AS
SELECT * FROM node_template
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND node_type = 'HTTP_REQUEST'
  AND config_json LIKE '%backend-stage.vacademy.io%';

BEGIN;
UPDATE node_template
SET config_json = REPLACE(config_json,
                          'backend-stage.vacademy.io',
                          'backend.vacademy.io'),
    updated_at = NOW()
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND node_type = 'HTTP_REQUEST'
  AND config_json LIKE '%backend-stage.vacademy.io%';

SELECT COUNT(*) AS still_stage FROM node_template
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND config_json LIKE '%backend-stage.vacademy.io%';
-- Expected: 0

COMMIT;  -- or ROLLBACK
```

Recommend a canary first: update `nt_js_day_02_http` only, watch tomorrow's 9 AM run, then bulk update.

#### Bug 2 (filter restructure)

Two design options — pick one before writing the migration:

- **Option A (1-hour stopgap):** Change all `little_win_day_*_level_*` and `little_win_day_*_pm` TRANSFORM `compute` from `?.?[ filter ]?.![ map ]` to plain `.![ map ]` like the catch-up. **Side effect:** the three level workflows for the same day will all fire on the same leads, sending 3× messages. To prevent that, deactivate two of the three level workflows per day (e.g. keep only `_level_2`).
- **Option B (proper fix):** Compute each lead's level once at intake (from `dob` or `child age` custom field), persist as a new `custom_field_values` row, and route the appropriate template per lead in TRANSFORM. Single workflow per day, three template variants based on `#this['child level']`. Best UX, more eng work.

### 4. Bug 8 — clean up duplicate Day-4 Level-2 workflows
Required before deploying Bug 1+2 to prevent triple sends.

```sql
-- on admin_core_service
UPDATE workflow
SET status = 'DELETED', updated_at = NOW()
WHERE id IN ('b7cea079-637b-4896-be62-1692fc56adf1',
             '6c251574-c260-4586-b2ad-341ffa766757',
             'aec53df0-418c-475b-a94b-29428e97e99e');
```

### 5. Bug 3 — WATI contact attributes
Inspect notification_service WATI sender code for the contact-upsert path. Confirm what attributes are passed. Add `allowcampaigns=true` and any template-required `attribute_N` defaults.

### 6. Bug 7 — strip `+` in webhook
In `FormWebhookService` (admin_core_service), normalize phone before writing to `custom_field_values`. Trim leading `+`, ensure 12-digit India format.

### 7. Bug 6 — FB Day 4 / Day 6 SpEL keys
- Rename FB connectors' `default_values_json` key `"FB Name"` → `"PM Name"`.
- In FB Day 4 / Day 6 SEND_WHATSAPP `forEach.eval`: change `'location link'` → `'Location Link'`, `'school phone'` → `'School Phone'`, `'fb name'` → `'PM Name'`.

---

## What the user has already fixed (as of 2026-04-28)

User said "okay fixed that" but did not specify which bug. Confirm in the next chat before assuming any of Bugs 1–8 is closed.

---

## Open questions / unknowns

1. **Is the DB queried prod or staging?** Strong evidence (real customer phones, ~1,100+ leads, real reply data) suggests prod, but never explicitly confirmed.
2. **Why is the catch-up's HTTP_REQUEST node dead code?** Intentional (someone disabled the filter) or vestigial (forgot to remove)? Affects whether Bug 2 fix mirrors catch-up exactly.
3. **What's the actual WATI failure reason for `days_1_js_new`?** `notification_log.body` only shows "Status: FAILED" without Meta error code. WATI's "Failed Messages" report or `message_payload` JSON should have it.
4. **Are Pashan and Kalyani Nagar centers actually live?** 0 leads in 3 months. Could be the centers aren't active, or their Zoho webhooks are misconfigured.
5. **Opt-out flow:** confirmed it writes to `notification_service.user_announcement_settings.is_unsubscribed`, NOT to a separate "OPT OUT" audience. Filtering happens at SEND time (post-QUERY), so opted-out leads still appear in workflow execution logs but the actual provider call is suppressed.

---

## Useful diagnostic queries

### Lead end-to-end trace (replace `<phone>`)
```sql
-- on notification_service
SELECT notification_type, LEFT(body, 200) AS body_preview, source_id,
       sender_business_channel_id, notification_date
FROM notification_log
WHERE channel_id = '<phone>'
ORDER BY created_at ASC;
```

### Find a lead by name (admin_core_service)
```sql
SELECT cf.field_key, cf.field_name, cfv.source_id AS audience_response_id,
       cfv.value, cfv.created_at
FROM custom_field_values cfv
JOIN custom_fields cf ON cf.id = cfv.custom_field_id
WHERE cfv.value ILIKE '%<name>%'
ORDER BY cfv.created_at DESC LIMIT 50;
```

### All custom fields for one lead (admin_core_service)
```sql
SELECT cf.field_name, cfv.value
FROM custom_field_values cfv
JOIN custom_fields cf ON cf.id = cfv.custom_field_id
WHERE cfv.source_id = '<audience_response_id>'
ORDER BY cf.field_name;
```

### Recent execution log for any workflow
```sql
SELECT we.id, we.started_at, wel.node_type, wel.status,
       LEFT(wel.details_json, 800) AS details_preview
FROM workflow_execution we
JOIN workflow_execution_log wel ON wel.workflow_execution_id = we.id
WHERE we.workflow_id = '<workflow_id>'
  AND we.created_at >= NOW() - INTERVAL '7 days'
ORDER BY we.started_at DESC, wel.started_at;
```

### Template success/fail rate over time
```sql
-- notification_service
SELECT DATE(notification_date) AS day,
       COUNT(*) FILTER (WHERE body LIKE '%Status: SUCCESS%') AS success,
       COUNT(*) FILTER (WHERE body LIKE '%Status: FAILED%')  AS failed
FROM notification_log
WHERE source_id = '<template_name>'
  AND notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
GROUP BY DATE(notification_date)
ORDER BY day DESC LIMIT 30;
```

---

## Reference: schema notes worth remembering

- **`custom_field_values`** has no `audience_response_id`. Use `source_type='AUDIENCE_RESPONSE'`, `source_id=<audience_response.id>`.
- **`custom_fields`** has no `audience_id` or `institute_id`. It's global. Scoping is via `institute_custom_fields(institute_id, type='AUDIENCE_FORM', type_id=<audience_id>, custom_field_id)`.
- **`workflow.id`** is sometimes a human-readable string (`little_win_day_2_level_1`) and sometimes a UUID. `workflow.name` is the display name (`Js Challenge day 2 level 1`). Don't filter on `name LIKE 'little_win%'`.
- `audience_response.parent_name` / `parent_email` / `parent_mobile` exist but are unused. Real values are in `custom_field_values`.
- `audience_response.user_id` does not link to `user_lead_profile` or `student` tables for current Jumpstart leads. Likely a placeholder; identity lives entirely in `custom_field_values`.
- Cron expressions: AM `0 0 9 * * ?` (9 AM IST = 03:30 UTC), PM `0 0 18 * * ?` (6 PM IST = 12:30 UTC), Catch-up `0 0 20 * * ?` (8 PM IST = 14:30 UTC).
