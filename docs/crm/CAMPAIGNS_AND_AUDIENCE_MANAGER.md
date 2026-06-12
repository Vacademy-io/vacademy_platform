# Campaigns & Audience Manager — Lead List, Form Builder, Webhook Connectors

The funnel above individual leads: creating campaigns (audiences), building their public forms, sharing/embedding them, wiring third-party form and ad-platform webhooks, and browsing per-campaign responses. Frontend at [`src/routes/audience-manager/list/`](../../frontend-admin-dashboard/src/routes/audience-manager/list/); backend in [`features/audience/`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/).

> Last reviewed: 2026-06-10. Reflects code currently on `main`.
>
> Related: [Leads Management](LEADS_MANAGEMENT.md) (what happens to a submission), [Lead Assignment](LEAD_ASSIGNMENT_AND_COUNSELOR_POOLS.md) (pool ↔ audience linking), [Recent Leads UI](RECENT_LEADS_AND_FOLLOWUPS.md).

---

## 1. Concepts

An **audience** (UI label: "campaign", sidebar: "Lead List") is a lead-capture container: a public form definition + metadata + integrations. Submissions land as `audience_response` rows. The sidebar's Leads section ("CRM" category, [`sidebar/utils.ts:379`](../../frontend-admin-dashboard/src/components/common/layout-container/sidebar/utils.ts#L379)) contains: Lead List (`/audience-manager/list`), Recent Leads, Follow-ups, Counsellors, Sales Dashboard. (The reports page `/audience-manager/reports` exists but currently has no sidebar entry — reach it by URL.)

### `audience` table (key columns)

| Column | Meaning |
|---|---|
| `campaign_name`, `description`, `campaign_objective` | Display metadata |
| `campaign_type` | Comma-separated source tags (`WEBSITE,GOOGLE_ADS,FACEBOOK_ADS,…`) |
| `start_date` / `end_date` | Campaign window |
| `status` | `ACTIVE` / `PAUSED` / `COMPLETED` / `ARCHIVED` (UI filter: ACTIVE / INACTIVE / DRAFT) |
| `json_web_metadata`, `setting_json` | Webhook config / workflow + form metadata |
| `to_notify` | Comma-separated admin emails notified on submissions |
| `send_respondent_email` | Auto-confirmation toggle |
| `session_id` | Optional link to a package session (term) |
| `default_initial_score` | 0–50 floor score for every lead in this campaign (V266; default 20 in the form) |

---

## 2. Campaign CRUD

Backend (`AudienceController`, base `/admin-core-service/v1/audience`):

| Verb | Path | Purpose |
|---|---|---|
| POST | `/campaign` | Create |
| PUT | `/campaign/{audienceId}` | Update |
| POST | `/campaigns` (+ pageNo/pageSize) | Filtered, paginated list — respects `AUDIENCE_ROLE_ACCESS` RBAC |
| DELETE | `/campaign/{instituteId}/{audienceId}` | Soft delete |
| GET (open) | `/open/v1/audience/campaign/{instituteId}/{audienceId}` | Public campaign metadata for the form renderer |

Frontend: the list page ([`index.lazy.tsx`](../../frontend-admin-dashboard/src/routes/audience-manager/list/index.lazy.tsx)) renders a collapsible performance panel (conversion-by-source + calls-per-day widgets) above `<AudienceInvite />` — campaign cards, 6/page, search (300 ms debounce, URL-synced), status filter.

Each card's dropdown: Edit, Delete, Add Response (bulk import), Send Message, View Linked Workflows, Configure Audience Workflow, API Integration, Embed Code.

### Create/edit form

[`CreateCampaignDialog.tsx`](../../frontend-admin-dashboard/src/routes/audience-manager/list/-components/) + `CreateCampaignForm.tsx`, validated by [`AudienceCampaignSchema.ts`](../../frontend-admin-dashboard/src/routes/audience-manager/list/-schema/AudienceCampaignSchema.ts) (zod): name (≥3 chars), type, objective, start/end dates (end after start), status, `to_notify` emails, `send_respondent_email`, `default_initial_score` (0–50), campaign image, and the custom-field array.

### Custom fields (the form builder)

- Field catalog fetched from `/common/custom-fields?instituteId=` ([`getCampaignCustomFields.ts`](../../frontend-admin-dashboard/src/routes/audience-manager/list/-utils/getCampaignCustomFields.ts)) with dedup by key and alias-group handling (legacy `name`/`phone` vs `full_name`/`phone_number` never both appear).
- Three seeded fields are locked (`oldKey: true`): **Full Name, Email, Phone Number** — not deletable, even in edit mode.
- [`CampaignCustomFieldsCard.tsx`](../../frontend-admin-dashboard/src/routes/audience-manager/list/-components/) — drag-and-drop reorder, required-toggle, delete (non-seeded), add (text/dropdown/preset Gender/State/City), live form preview.

---

## 3. Sharing the form

- **Share link** ([`createCampaignLink.ts`](../../frontend-admin-dashboard/src/routes/audience-manager/list/-utils/createCampaignLink.ts)): `{learner_portal_base_url}/audience-response?instituteId=…&audienceId=…` (enquiry variant: `/enquiry-response?…&enquiryId=…`). The public form is rendered by the **learner app**, not the admin dashboard.
- **Embed Code dialog**: three variants — floating button + popup, inline iframe, plain link — with button text/color/radius and frame size customization.
- **API Integration dialog**: shows a copyable cURL against the open submit endpoint with the campaign's actual custom-field ids, plus Zapier/Make notes:

```
POST /admin-core-service/open/v1/audience/lead/submit
{
  "audience_id": "<campaignId>",
  "source_type": "AUDIENCE_CAMPAIGN",
  "source_id": "<campaignId>",
  "custom_field_values": { "<fieldId>": "<value>", … },
  "user_dto": { "username": "<email>", "email": "…", "full_name": "…", "mobile_number": "…" }
}
```

The full set of open submission endpoints (v2, with-enquiry, bulk) is catalogued in [LEADS_MANAGEMENT.md §2](LEADS_MANAGEMENT.md).

---

## 4. Campaign Users page

`/audience-manager/list/campaign-users?campaignId=…&campaignName=…&customFields=…&campaignType=…` ([`campaign-users/index.tsx`](../../frontend-admin-dashboard/src/routes/audience-manager/list/campaign-users/index.tsx)).

[`campaign-users-table.tsx`](../../frontend-admin-dashboard/src/routes/audience-manager/list/-components/campaign-users/campaign-users-table.tsx) is the per-campaign twin of Recent Leads — same backend endpoint (`POST /v1/audience/leads` with `audience_id` pinned), same `LeadTable`-style columns (name, contact, source, tier, reach-out-by, follow-up-by, status, counsellor, actions), same filters (search, tier, status incl. `__ACTIVE__` exclude-converted default, SLA bucket, counsellor, date range) plus **custom-field filters** (AND-combined `{field_id, value}` pairs). Rows open the shared student side-view; actions reuse the shared add-note / assign-counsellor / send-message dialogs.

Bulk actions: CSV bulk-import dialog ([`lead-bulk-import-utils.ts`](../../frontend-admin-dashboard/src/routes/audience-manager/list/-utils/) parses + maps columns to fields) and Send Message.

Query keys: `['campaignsList', instituteId, page, size, name, status, type]`, `['campaignUsers', audienceId, …all filters]`, `['customFieldSetup', instituteId]`, `['campaignById', audienceId]` (all staleTime 1 min).

---

## 5. Campaign ↔ workflow integration

Two dialogs on the campaign card:

- **Linked Workflows** ([`linked-workflows-dialog.tsx`](../../frontend-admin-dashboard/src/routes/audience-manager/list/-components/linked-workflows-dialog.tsx)) lists workflows that will fire for this campaign, matched two ways: event-driven (`trigger_event_name = 'AUDIENCE_LEAD_SUBMISSION'` with `event_id` = this audience or global/null) and scheduled (QUERY node using `fetch_audience_responses_filtered` / `getAudienceResponsesByDayDifference` with matching/absent `audienceId` param). A campaign-specific trigger suppresses the global one at fire time.
- **Configure Audience Workflow** ([`configure-audience-workflow-dialog.tsx`](../../frontend-admin-dashboard/src/routes/audience-manager/list/-components/configure-audience-workflow-dialog.tsx)) creates simple workflows inline from two templates — confirmation email (event-driven) and follow-up-after-N-days (scheduled) — emitting the same JSON the full workflow builder uses.

`audience_response.workflow_activate_day_at` supports day-offset workflow activation per campaign.

---

## 6. Webhook connectors (third-party forms & ad platforms)

All connector state lives in the `form_webhook_connector` table: `vendor` (`ZOHO_FORMS` / `GOOGLE_FORMS` / `MICROSOFT_FORMS` / `META_LEAD_ADS` / `GOOGLE_LEAD_ADS`), `vendor_id`, `audience_id`, field-mapping JSON, routing rules, `connection_status`, plus encrypted OAuth columns for Meta (`oauth_access_token_enc`, AES-256-GCM).

### 6.1 Generic form webhooks (Zoho / Google Forms / Microsoft Forms)

```
POST /admin-core-service/api/v1/audience/webhook/form    (public, X-Vendor-ID header)
  → FormWebhookService.processFormWebhookByVendorId
  → vendor strategy extracts ProcessedFormDataDTO {email*, fullName, phone, customFields}
  → AudienceService.submitLeadFromFormWebhook(audienceId, data, provider)
```

Strategies live in [`features/audience/strategy/`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/strategy/). Adding a vendor = one new strategy class + connector row.

### 6.2 Meta Lead Ads (OAuth + webhook)

Setup via `MetaOAuthController` (`/admin-core-service/v1/oauth/meta`):

1. `POST /initiate` → `{oauth_url, session_key}`; admin consents on Meta.
2. `GET /callback` exchanges the code for a long-lived token; tokens are **encrypted server-side** into `oauth_connect_state` (never sent to the browser — the client only ever holds the `session_key`).
3. `GET /session/{key}/pages` → `/pages/{pageId}/forms` → `/forms/{formId}/fields` — admin picks page + form, maps fields.
4. `POST /connector` saves the `FormWebhookConnector` and subscribes the page to the leadgen webhook via Graph API.

Runtime: `GET/POST /admin-core-service/api/v1/webhook/meta` — GET answers the `hub.challenge` handshake; POST verifies `X-Hub-Signature-256` (HMAC-SHA256), then asynchronously fetches the full lead from the Graph API and funnels it through `submitLeadFromFormWebhook`. Connector management: `GET/PUT/DELETE /v1/oauth/meta/connectors[/{id}]`.

### 6.3 Google Lead Form Extensions

No OAuth. A static `googleKey` is embedded in the webhook URL configured on the Google Ads side:

```
POST /admin-core-service/api/v1/webhook/google/{googleKey}
```

The payload contains the full lead (FULL_NAME / EMAIL / PHONE_NUMBER / CUSTOM_QUESTION_*); the connector is created via `POST /v1/oauth/meta/google/connector` (same controller, no OAuth steps).

### 6.4 Pool linking

Attaching a campaign to a counselor pool (for auto-assignment) is done from the **pool** side — Settings → Lead Settings → Pools → Audiences tab (`POST /v1/counselor-pool/{poolId}/audiences`). A campaign can be in at most one pool (UNIQUE on `audience_id`). See the [assignment doc](LEAD_ASSIGNMENT_AND_COUNSELOR_POOLS.md).

---

## 7. Communication & misc

- `POST /v1/audience/campaign/{audienceId}/send` — send a message to all leads in a campaign; `GET /campaign/{audienceId}/communications` — paginated history.
- `POST /v1/audience/center-heatmap` — engagement heatmap by center.
- Opt-out: `POST /admin-core-service/internal/audience/opt-out` moves a user to the opt-out audience (`source_type = OPT_OUT`, `source_id` = previous audience) and soft-deletes the active response.

---

## 8. End-to-end: from campaign to counsellor

```
Admin creates campaign (+custom fields, +default_initial_score)
   └─ optionally: attach to counselor pool · wire Meta/Google/Zoho connector · link workflows
Lead submits (share link / embed / webhook / walk-in / bulk)
   └─ audience_response + custom fields + lead_score (+initial_score floor)
   └─ user_lead_profile built/updated (best_score, tier)
   └─ pool auto-assign (ROUND_ROBIN / TIME_BASED) → assigned_counselor_id
   └─ LEAD_SUBMITTED workflow trigger → confirmation email / admin notify
Counsellor works it (Recent Leads / Follow-ups / Workbench)
   └─ status transitions → lead_status_history → CONVERTED freezes scoring
Reports & Sales Dashboard aggregate the result
```
