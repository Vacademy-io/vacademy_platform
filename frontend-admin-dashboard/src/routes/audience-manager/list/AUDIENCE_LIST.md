# Audience List — Current Implementation

A technical reference for how the **Audience List** feature works today in `frontend-admin-dashboard`. The feature lets an institute admin create *audience campaigns* (forms / capture surfaces), share them, collect *leads / responses*, and message respondents.

> Root: [src/routes/audience-manager/list/](src/routes/audience-manager/list/)

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Feature name in UI | "Manage Audience Lists" (label is terminology-driven; see `OtherTerms.AudienceList`) |
| Domain entities | **Campaign / Audience** (the form/list itself) and **Lead / Response** (a submission to a campaign) |
| Primary route | `/audience-manager/list/` |
| Sub-route | `/audience-manager/list/campaign-users/` (responses for one campaign) |
| Add-response route | `/audience-manager/list/campaign-users/add/` |
| Backend service | `admin-core-service` — `/v1/audience/*` (auth) and `/open/v1/audience/*` (public submit) |

Conceptually the feature is split into two screens:

1. **Campaigns list** — cards of all campaigns with create/edit/delete + utility actions (API integration, embed, send message, bulk import).
2. **Campaign users (leads) table** — paginated table of submissions for a single campaign, with date filtering, CSV export, bulk import, send-message and add-response.

---

## 2. File Structure

```
src/routes/audience-manager/list/
├── index.tsx                          # Route definition
├── index.lazy.tsx                     # Page component (AudienceManagerListPage)
├── -components/
│   ├── audience-invite/
│   │   ├── audience-invite.tsx                    # Campaigns list + filters
│   │   └── audience-campaign-card-menu-options.tsx# Per-campaign 3-dot menu
│   ├── create-campaign-dialog/
│   │   ├── CreateCampaignDialog.tsx               # Modal wrapper
│   │   ├── CreateCampaignForm.tsx                 # Create / edit form
│   │   ├── CampaignCustomFieldsCard.tsx
│   │   ├── CampaignTypeDropdown.tsx
│   │   ├── StatusDropdown.tsx
│   │   ├── CampaignLink.tsx
│   │   └── MultiEmailInput.tsx
│   ├── campaign-users/
│   │   ├── campaign-users-table.tsx               # Leads table
│   │   ├── LeadBulkImportDialog.tsx               # CSV bulk import
│   │   ├── SendMessageDialog.tsx                  # Multi-channel messaging
│   │   └── CommunicationHistory.tsx
│   ├── api-integration-dialog/
│   │   └── ApiIntegrationDialog.tsx               # Endpoint + cURL guide
│   └── embed-code-dialog/
│       └── EmbedCodeDialog.tsx                    # HTML/JS embed snippets
├── -context/
│   └── useAudienceInviteFormContext.tsx           # Re-export of InviteFormProvider
├── -hooks/
│   ├── useCampaignsList.ts
│   ├── useCampaignUsers.ts
│   ├── useGetCampaignById.ts
│   ├── useCustomFieldSetup.ts
│   ├── useAudienceCampaignForm.ts
│   ├── useCreateAudienceCampaign.ts
│   └── useUpdateAudienceCampaign.ts
├── -schema/
│   └── AudienceCampaignSchema.ts                  # Zod schema + types
├── -services/
│   ├── get-campaigns-list.ts
│   ├── get-campaign-users.ts
│   ├── get-campaign-by-id.ts
│   ├── get-custom-field-setup.ts
│   ├── get-recent-leads.ts
│   ├── create-audience-campaign.ts                # POST + PUT
│   ├── delete-audience-campaign.ts
│   ├── submit-audience-lead.ts                    # Single submit + cURL gen
│   ├── bulk-submit-audience-lead.ts
│   ├── delete-audience-lead.ts
│   └── send-audience-message.ts
├── -utils/
│   ├── getCampaignCustomFields.ts                 # Field fetching + aliasing
│   ├── createCampaignLink.ts                      # Shareable learner-portal link
│   └── lead-bulk-import-utils.ts                  # CSV parse/validate
└── campaign-users/
    ├── index.tsx                                  # Leads listing route
    └── add/
        └── index.tsx                              # Add response form route
```

---

## 3. Routing

Defined with TanStack Router file-based routes.

| File | Path | Purpose |
|---|---|---|
| [index.tsx](src/routes/audience-manager/list/index.tsx) | `/audience-manager/list/` | Route entry |
| [index.lazy.tsx](src/routes/audience-manager/list/index.lazy.tsx) | (lazy component) | Renders `AudienceManagerListPage` |
| [campaign-users/index.tsx](src/routes/audience-manager/list/campaign-users/index.tsx) | `/audience-manager/list/campaign-users/` | Leads table; reads `campaignId`, `campaignName`, `customFields`, `campaignType` from search params |
| [campaign-users/add/index.tsx](src/routes/audience-manager/list/campaign-users/add/index.tsx) | `/audience-manager/list/campaign-users/add/` | Add-response form |

The page entrypoint at [index.lazy.tsx:15-29](src/routes/audience-manager/list/index.lazy.tsx#L15-L29) sets the nav heading via `useNavHeadingStore` and wraps `<AudienceInvite />` in `AudienceInviteFormProvider` and `LayoutContainer`.

---

## 4. Data Layer

### 4.1 API endpoints (from [src/constants/urls.ts:73-93](src/constants/urls.ts#L73-L93))

| Constant | Method | URL | Used by |
|---|---|---|---|
| `AUDIENCE_CAMPAIGN` | POST / PUT / DELETE | `/admin-core-service/v1/audience/campaign[/{instituteId}/{audienceId}]` | create-, update-, delete-audience-campaign |
| `AUDIENCE_CAMPAIGNS_LIST` | POST | `/admin-core-service/v1/audience/campaigns` | get-campaigns-list |
| `GET_CAMPAIGN_USERS` | POST | `/admin-core-service/v1/audience/leads` | get-campaign-users |
| `DELETE_AUDIENCE_LEAD(responseId)` | DELETE | `/admin-core-service/v1/audience/lead/{responseId}` | delete-audience-lead |
| `SUBMIT_AUDIENCE_LEAD_URL` | POST | `/admin-core-service/open/v1/audience/lead/submit` | submit-audience-lead (open / public) |
| `BULK_SUBMIT_AUDIENCE_LEAD` | POST | `/admin-core-service/open/v1/audience/lead/bulk-submit` | bulk-submit-audience-lead |
| `GET_CUSTOM_FIELD_SETUP` | GET | `/admin-core-service/common/custom-fields/setup` | get-custom-field-setup |
| (open campaign) | GET | `/admin-core-service/open/v1/audience/campaign/{instituteId}/{audienceId}` | get-campaign-by-id |
| (send) | POST | `/admin-core-service/v1/audience/campaign/{audienceId}/send` | send-audience-message |
| (history) | GET | `/admin-core-service/v1/audience/campaign/{audienceId}/communications` | send-audience-message |

> All non-`open/*` endpoints go through `authenticatedAxiosInstance`; `open/*` endpoints accept anonymous calls so the form can be embedded externally.

### 4.2 React Query hooks

| Hook | Query key | Notes |
|---|---|---|
| `useCampaignsList` | `['campaignsList', institute_id, page, size, name, status, type]` | `staleTime: 60s`. Server fetch size = 200, then client-side filtered & paginated (5 cards / page) |
| `useCampaignUsers` | `['campaignUsers', audience_id, page, size, sort_by, sort_dir, source_type, source_id, from, to]` | Page size = 10 |
| `useGetCampaignById` | `['campaign', instituteId, audienceId]` | `staleTime: 0`, `gcTime: 0` — always fresh on edit-open |
| `useCustomFieldSetup` | `['customFieldSetup', instituteId]` | `staleTime: 5min` |

### 4.3 Mutations

| Hook | Action | Invalidates |
|---|---|---|
| `useCreateAudienceCampaign` | POST `AUDIENCE_CAMPAIGN` | `['audienceList']`, `['audiences']`, `['campaignsList']` |
| `useUpdateAudienceCampaign` | PUT `AUDIENCE_CAMPAIGN/{id}` | `['campaignsList']` |
| (inline in menu) | DELETE `AUDIENCE_CAMPAIGN/{instituteId}/{audienceId}` | `['campaignsList']` |
| (inline in add page) | POST `SUBMIT_AUDIENCE_LEAD_URL` | `['campaignUsers']` |
| (bulk import) | POST `BULK_SUBMIT_AUDIENCE_LEAD` | `['campaignUsers']` |
| (send message) | POST `…/{audienceId}/send` | — |

### 4.4 Stores & context

- `useNavHeadingStore` — sets the page header.
- `useInstituteDetailsStore` — current institute id, used in every payload.
- `useStudentSidebar` — opens the lead profile drawer when a row is clicked.
- `AudienceInviteFormProvider` — shared form state, re-exported from `manage-students/InviteFormProvider`.

---

## 5. Form Schema

Defined in [`-schema/AudienceCampaignSchema.ts`](src/routes/audience-manager/list/-schema/AudienceCampaignSchema.ts). Validated with Zod via `zodResolver` inside `useAudienceCampaignForm`.

Fields:

- `campaign_name` — string, min 3 chars
- `campaign_type` — uppercase string (selectable from `CampaignTypeDropdown`)
- `description`, `campaign_objective` — optional strings
- `start_date_local`, `end_date_local` — required ISO dates; cross-field validated
- `status` — `ACTIVE | INACTIVE | DRAFT`
- `custom_fields` — array of `{ id, name, key, type, isRequired, order, options?, status }`
- `institute_custom_fields` — JSON-stringified custom field definitions
- `json_web_metadata` — optional string (used by embed customization)
- `send_respondent_email`, `to_notify` — email notification config
- `campaign_image` — optional URL

---

## 6. UI Components & Roles

### Campaigns list — `AudienceInvite` ([audience-invite.tsx:37-452](src/routes/audience-manager/list/-components/audience-invite/audience-invite.tsx#L37-L452))

Top-level layout for the list screen.

- Search box (campaign name).
- Status filter tabs: `ALL | ACTIVE | INACTIVE | DRAFT`.
- "Add Audience List" button → opens `CreateCampaignDialog`.
- Renders campaign cards: name, type badge, status badge, start/end dates, description (2-line clamp), objective, shareable link (only when `ACTIVE`), `Add Response`/`API`/`Embed` quick actions, and a 3-dot menu.
- Pagination component below cards.

### Per-card menu — `AudienceCampaignCardMenuOptions` ([audience-campaign-card-menu-options.tsx:40-246](src/routes/audience-manager/list/-components/audience-invite/audience-campaign-card-menu-options.tsx#L40-L246))

Dropdown actions:

| Action | Behavior |
|---|---|
| Edit | Opens `CreateCampaignDialog` pre-filled via `useGetCampaignById` |
| Add Response | Navigates to `/audience-manager/list/campaign-users/add` with `campaignId` |
| Bulk Import CSV | Opens `LeadBulkImportDialog` |
| Send Message | Opens `SendMessageDialog` |
| API Integration | Opens `ApiIntegrationDialog` (endpoint + cURL + docs) |
| Embed Code | Opens `EmbedCodeDialog` (button-popup and direct-link snippets) |
| Delete | Confirmation dialog → DELETE → invalidates `campaignsList` |

### Create / Edit form — `CreateCampaignForm`

Driven by `useAudienceCampaignForm` (RHF + Zod). Loads custom fields via `getCampaignCustomFieldsAsync()` (or from `useGetCampaignById` when editing). Submits through `useCreateAudienceCampaign` or `useUpdateAudienceCampaign` depending on mode.

### Leads table — `CampaignUsersTable`

- Reads `campaignId`, `campaignName`, `customFields`, `campaignType` from URL search params.
- Fetches with `useCampaignUsers`.
- Dynamic columns: S.No → custom-field columns → submitted date → details.
- Date range filter (`submitted_from_local` / `submitted_to_local`).
- CSV download / bulk import / send message / delete-row.
- Clicking a row opens `StudentSidebar` (from manage-students module) with the lead's profile.

### Add-response page

- Custom fields fetched from URL search-param JSON or `GET custom-fields/feature-fields?type=AUDIENCE_FORM&typeId={campaignId}` as fallback.
- Renders dynamic inputs via `CustomFieldRenderer`.
- Extracts `email`, `phone`, `full_name` from custom field values to build `SubmitLeadRequest`.
- POSTs to `SUBMIT_AUDIENCE_LEAD_URL`, invalidates `campaignUsers`, navigates back.

### Bulk import — `LeadBulkImportDialog`

Three-step CSV flow:

1. Download generated template (`generateCsvTemplate` from custom fields).
2. Upload + parse with `papaparse`; validate headers via `buildHeaderToFieldIdMap`.
3. Preview rows with row-level validation (`validateRow`, `getMissingMandatoryColumns`); submit via `BULK_SUBMIT_AUDIENCE_LEAD`.

### Messaging — `SendMessageDialog`

Channels: WhatsApp (templated), Email, Push, System Alert. Supports template variables and audience filters; posts to `…/{audienceId}/send`. Past communications loaded via `CommunicationHistory`.

### Integration helpers

- **ApiIntegrationDialog** — shows `SUBMIT_AUDIENCE_LEAD_URL`, request shape, response shape, and `generateCurlCommand()` from `submit-audience-lead.ts`.
- **EmbedCodeDialog** — produces HTML/JS embed snippets (button-with-popup or direct-link variants), backed by `createCampaignLink()` to point at the learner portal's `/audience-response` (or `/enquiry-response` for enquiry-type campaigns).

---

## 7. Key Utilities

| Utility | Purpose |
|---|---|
| `getCampaignCustomFieldsAsync` ([getCampaignCustomFields.ts](src/routes/audience-manager/list/-utils/getCampaignCustomFields.ts)) | Async fetch + dedupe of custom fields; falls back to `getDefaultCampaignFields()` (Full Name / Email / Phone). Handles aliasing — e.g. `full_name` ↔ `name`, `phone` ↔ `phone_number` |
| `createCampaignLink` ([createCampaignLink.ts](src/routes/audience-manager/list/-utils/createCampaignLink.ts)) | Builds shareable learner-portal URL with encoded institute & campaign IDs; `/audience-response` or `/enquiry-response` |
| `lead-bulk-import-utils` ([lead-bulk-import-utils.ts](src/routes/audience-manager/list/-utils/lead-bulk-import-utils.ts)) | CSV parse / template gen / header-to-field mapping / row validation |
| `generateCurlCommand` (in `submit-audience-lead.ts`) | Builds copy-paste cURL for ApiIntegrationDialog |

---

## 8. End-to-End User Flows

### A. Browse campaigns

1. Visit `/audience-manager/list/`.
2. `useCampaignsList` POSTs to `AUDIENCE_CAMPAIGNS_LIST` (server fetches up to 200).
3. Client-side filter (search + status) + paginate (5 / page).
4. Cards render with quick actions.

### B. Create or edit a campaign

1. Click **Add Audience List** (or Edit on a card).
2. `CreateCampaignDialog` opens; on edit, `useGetCampaignById` hydrates the form.
3. User fills metadata + custom fields; Zod validates.
4. Submit → `useCreateAudienceCampaign` or `useUpdateAudienceCampaign` → list invalidated.

### C. View / collect responses

1. Card → **Add Response** navigates to `…/campaign-users/add?campaignId=…` with custom-field metadata in search params.
2. Or open `…/campaign-users?campaignId=…` to view existing leads (`useCampaignUsers`).
3. Row click → `StudentSidebar` with lead profile.

### D. Bulk import leads (CSV)

1. Card menu → **Bulk Import CSV**.
2. Download template → fill → upload → preview → submit → `BULK_SUBMIT_AUDIENCE_LEAD`.

### E. Message respondents

1. Card menu → **Send Message** → choose channel + template → POST `…/{audienceId}/send`.
2. View past sends in `CommunicationHistory`.

### F. Integrate externally

- **API Integration** dialog: shows endpoint + sample payload + cURL.
- **Embed Code** dialog: HTML/JS to drop into a website (uses public `audience-response` page).

---

## 9. External Dependencies

- **TanStack Router** — file-based routing + typed search params.
- **TanStack React Query** — fetching, mutations, cache invalidation.
- **React Hook Form + Zod** — form state and validation.
- **PapaParse** — CSV parsing for bulk import.
- **Sonner** — toast notifications.
- **react-helmet** — page metadata.
- **Lucide / Phosphor Icons** — icons.
- **Internal**: `MyTable`, `MyPagination`, `MyButton` (design system); `CustomFieldRenderer`, `StudentSidebar` (manage-students); `DashboardLoader`; `authenticatedAxiosInstance`.

---

## 10. Quick File Reference

| Concern | Path |
|---|---|
| Page entry | [index.lazy.tsx](src/routes/audience-manager/list/index.lazy.tsx) |
| List view | [audience-invite.tsx](src/routes/audience-manager/list/-components/audience-invite/audience-invite.tsx) |
| Card menu | [audience-campaign-card-menu-options.tsx](src/routes/audience-manager/list/-components/audience-invite/audience-campaign-card-menu-options.tsx) |
| Create/edit form | [CreateCampaignForm.tsx](src/routes/audience-manager/list/-components/create-campaign-dialog/CreateCampaignForm.tsx) |
| Leads table | [campaign-users-table.tsx](src/routes/audience-manager/list/-components/campaign-users/campaign-users-table.tsx) |
| Add response | [campaign-users/add/index.tsx](src/routes/audience-manager/list/campaign-users/add/index.tsx) |
| Bulk import | [LeadBulkImportDialog.tsx](src/routes/audience-manager/list/-components/campaign-users/LeadBulkImportDialog.tsx) |
| Send message | [SendMessageDialog.tsx](src/routes/audience-manager/list/-components/campaign-users/SendMessageDialog.tsx) |
| API integration | [ApiIntegrationDialog.tsx](src/routes/audience-manager/list/-components/api-integration-dialog/ApiIntegrationDialog.tsx) |
| Embed code | [EmbedCodeDialog.tsx](src/routes/audience-manager/list/-components/embed-code-dialog/EmbedCodeDialog.tsx) |
| Schema | [AudienceCampaignSchema.ts](src/routes/audience-manager/list/-schema/AudienceCampaignSchema.ts) |
| URL constants | [src/constants/urls.ts](src/constants/urls.ts) (lines 73–93) |

---

## 11. Lead Scoring & Tier (Cold / Warm / Hot)

Each lead surfaced in the audience-list ecosystem can carry a **score (0–100)** and a **tier** (`HOT`, `WARM`, `COLD`). The score is **computed entirely on the backend**; the frontend only fetches it, renders the badge, and lets an admin manually override the tier.

### 11.1 Where the score comes from

- The score is **not computed on the client**. The backend persists a `UserLeadProfile` per `(user_id, institute_id)` and recomputes the score on its own schedule (new submissions, timeline events, profile updates). A `last_calculated_at` timestamp is exposed.
- The frontend retrieves it through:
  - `GET /admin-core-service/v1/audience/user-lead-profile` — single profile (`GET_USER_LEAD_PROFILE`).
  - `POST /admin-core-service/v1/audience/user-lead-profiles/batch` — batch fetch by user-id list (`GET_USER_LEAD_PROFILES_BATCH`). Used by the campaign-users table to fill badges row-by-row via the `useLeadProfiles()` hook.

### 11.2 `UserLeadProfile` shape (relevant fields)

```ts
{
  user_id: string
  institute_id: string
  best_score: number              // 0–100, backend-computed
  best_score_response_id: string | null
  lead_tier: 'HOT' | 'WARM' | 'COLD' | null   // explicit tier (manual override or backend-set)
  conversion_status: 'LEAD' | 'CONVERTED' | 'LOST'
  converted_at: string | null
  campaign_count: number
  best_source_type: string | null              // e.g. 'WALK_IN', 'GOOGLE_ADS'
  total_timeline_events: number                // engagement signal
  demo_login_count: number
  demo_attendance_count: number
  last_activity_at: string | null
  last_calculated_at: string | null            // when score was last recomputed
  assigned_counselor_id: string | null
  assigned_counselor_name: string | null
}
```

### 11.3 Score → Tier thresholds (display-only)

`LeadScoreBadge` ([src/components/shared/lead-score-badge.tsx](src/components/shared/lead-score-badge.tsx)) maps the numeric score to a tier badge. These thresholds are **only used for rendering** — they are not the source of truth, and they kick in only when `lead_tier` itself is null.

| Score range | Tier label | Badge color |
|---|---|---|
| `>= 80`     | **HOT**  | red — `bg-red-100 text-red-700` |
| `>= 50 && < 80` | **WARM** | amber — `bg-amber-100 text-amber-700` |
| `< 50`      | **COLD** | blue — `bg-blue-100 text-blue-700` |

Resolution order on a row: if `lead_tier` is present, it wins; otherwise the badge falls back to inferring the tier from `best_score` using the table above.

### 11.4 How the percentage is calculated (backend, configured by admins)

Although the math runs server-side, the **weights and inputs are fully configured from the admin UI** at `Settings → Lead Settings`:

> [src/routes/settings/-components/LeadSettings.tsx](src/routes/settings/-components/LeadSettings.tsx) — backed by `useLeadSettings()` ([src/hooks/use-lead-settings.ts](src/hooks/use-lead-settings.ts)), persisted under the institute setting key `LEAD_SETTING` via `GET_INSITITUTE_SETTINGS` (GET) and the `/save-setting` variant (POST).

The composite score is a **weighted average** of four components. The form **enforces that the four weights sum to exactly 100** before saving.

| Component | Default weight | What feeds it |
|---|---|---|
| **Source Quality** | 25 % | Lead's `best_source_type` — e.g. Walk-in scores higher than Google Ads, manual entry lowest. |
| **Profile Completeness** | 30 % | Percent of key user/response fields populated (name, email, phone, class, …). |
| **Recency** | 25 % | Time-decay against `submitted_at` using a configurable `recencyDecayDays` (default 30). A submission today ≈ 100 for this component; one at the decay horizon ≈ 50; older decays toward 0. |
| **Engagement** | 20 % | `total_timeline_events` — counts notes, calls, meetings, follow-ups, demo attendance, etc. |

Conceptually:

```
score = (sourceQualityWeight   * sourceQualityScore
       + completenessWeight    * completenessScore
       + recencyWeight         * recencyScore
       + engagementWeight      * engagementScore) / 100
```

…where each component score is itself normalized to 0–100. The result is the `best_score` exposed on the profile.

**Recalculation triggers** (inferred — backend-driven): a new form submission against any of the user's campaigns, a new timeline event, a user-profile update. Scores are **frozen once `conversion_status === 'CONVERTED'`** — the badge is hidden in that state in tables like Manage Contacts to avoid showing a stale percentage.

### 11.5 Admin overrides

A counselor can override either field manually from the lead profile sidebar:

- `POST /admin-core-service/v1/audience/user-lead-profile/update-tier` (`UPDATE_LEAD_TIER`) — body: `{ userId, instituteId, tier }` with `tier ∈ {HOT, WARM, COLD}`.
- `POST /admin-core-service/v1/audience/user-lead-profile/update-status` (`UPDATE_LEAD_STATUS`) — sets `conversion_status` to `LEAD | CONVERTED | LOST`.
- `POST /admin-core-service/v1/audience/user-lead-profile/mark-converted` (`MARK_LEAD_CONVERTED`).
- `POST /admin-core-service/v1/audience/user-lead-profile/assign-counselor` (`ASSIGN_COUNSELOR_TO_LEAD`).

These are wired in the lead-profile drawer at [student-lead-profile.tsx](src/routes/manage-students/students-list/-components/students-list/student-side-view/student-lead-profile/student-lead-profile.tsx) — the HOT/WARM/COLD buttons highlight the resolved active tier (explicit `lead_tier`, else inferred from `best_score`).

### 11.6 Visibility flags

Lead settings expose **per-table toggles** so admins can control where badges appear, plus a master switch:

| Flag | Effect |
|---|---|
| `enabled` | Master switch — when off, lead UI is hidden institute-wide. |
| `showScoreInEnquiryTable` | Admissions / Enquiries table; **also gates the Audience-List Campaign-Users table and the Recent-Leads page**. |
| `showScoreInContactsTable` | Manage Contacts table. |
| `showScoreInStudentsTable` | Manage Students table. |

Inside the Campaign-Users table the badge is rendered in the name cell only when (a) `showScoreInEnquiryTable` (or its equivalent flag in this code path) is on, **and** (b) the row's response is linked to a real user — bare form submissions without a `user_id` show no badge.

### 11.7 Where the badge actually appears

| Surface | File |
|---|---|
| Audience-list **Campaign Users** table (the leads table for one campaign) | [campaign-users-columns.tsx](src/routes/audience-manager/list/-components/campaign-users/campaign-users-columns.tsx) — uses `useLeadProfiles` from [campaign-users-table.tsx](src/routes/audience-manager/list/-components/campaign-users/campaign-users-table.tsx) |
| Audience-manager **Recent Leads** page | [recent-leads-page.tsx](src/routes/audience-manager/recent-leads/-components/recent-leads-page.tsx) |
| Student lead-profile drawer (full detail + manual override) | [student-lead-profile.tsx](src/routes/manage-students/students-list/-components/students-list/student-side-view/student-lead-profile/student-lead-profile.tsx) |
| Manage Students list | [students-list-section.tsx](src/routes/manage-students/students-list/-components/students-list/student-list-section/students-list-section.tsx) |
| Manage Contacts list | [contacts-table-columns.tsx](src/routes/manage-contacts/-components/contacts-table-columns.tsx) |

### 11.8 TL;DR

- **Score (0–100)** is calculated by the **backend** using a configurable weighted sum of *Source Quality + Profile Completeness + Recency + Engagement* (defaults 25 / 30 / 25 / 20, must sum to 100).
- **Tier (HOT / WARM / COLD)** comes from the explicit `lead_tier` field if present (manual override or backend-set), otherwise the frontend buckets the score with `>=80 → HOT`, `>=50 → WARM`, `<50 → COLD`.
- The Audience-List campaign-users table fetches profiles in a **batch call** (`useLeadProfiles`) and renders a `LeadScoreBadge` per row, gated by institute lead-settings flags.
- Once a lead is **converted**, score updates are frozen and the badge is hidden in most tables.

---

## 12. What happens when a lead is enrolled to a Package / Course

> **Headline finding — there is a gap.** Enrolling a lead into a package/course does **not** automatically mark the lead as `CONVERTED`. Those are two independent actions wired to two different endpoints. A person can simultaneously be an active student *and* still appear as an open lead in campaign-users/recent-leads/manage-contacts unless an admin explicitly flips the conversion status.

### 12.1 Where the enrollment action lives

The "enroll to a package/course" action does **not** live inside the audience-manager UI. It is reached *through* a lead row by opening the **Student Sidebar** (the same drawer used for lead detail), and switching to the **Enroll/Deroll** tab.

Entry points that open this drawer for a lead:

| Surface | File |
|---|---|
| Audience-list **Campaign Users** table — row click / details | [campaign-users-table.tsx](src/routes/audience-manager/list/-components/campaign-users/campaign-users-table.tsx) |
| **Recent Leads** page — row click | [recent-leads-page.tsx](src/routes/audience-manager/recent-leads/-components/recent-leads-page.tsx) |
| **Manage Contacts** — row click | [contacts-list-section.tsx](src/routes/manage-contacts/-components/contacts-list-section.tsx) |
| **Manage Students** — row click | [students-list-section.tsx](src/routes/manage-students/students-list/-components/students-list/student-list-section/students-list-section.tsx) |

Inside the drawer, the **New Enrollment** section in [student-enroll-deroll.tsx](src/routes/manage-students/students-list/-components/students-list/student-side-view/student-enroll-deroll/student-enroll-deroll.tsx) exposes three buttons:

- **Rent a book** → `RENT`
- **Buy a book** → `BUY`
- **Purchase membership** → `MEMBERSHIP`

Each button opens **`SimpleEnrollmentWizard`** ([simple-enrollment-wizard.tsx](src/components/common/students/enroll-manually/simple-enrollment-wizard.tsx)), which is a search + filter (Level, Session) + multi-select package picker, ending in an **Enroll (N)** confirm button.

### 12.2 What happens on submit

1. The wizard POSTs to **`ENROLL_LEARNER_V2`** — `POST /admin-core-service/v2/learner/enroll`.
2. Service: `enrollLearnerV2()` in [src/services/enrollment-actions.ts](src/services/enrollment-actions.ts).
3. Payload shape:
   ```ts
   {
     userId: string,
     institute_id: string,
     enrollmentType: 'MANUAL',
     learner_package_session_enrollments: [
       { package_session_id, plan_id, payment_option_id, enroll_invite_id }
     ]
   }
   ```
4. On success: toast "Enrolled successfully!", wizard closes, **only `['user-plans', userId]` is invalidated**.

### 12.3 What does **not** happen automatically

This is the part that surprises people:

| Expected? | Actually does it happen? |
|---|---|
| `conversion_status` flips to `CONVERTED` | ❌ No |
| `converted_at` is set | ❌ No |
| `MARK_LEAD_CONVERTED` is called | ❌ No |
| Lead disappears from Campaign-Users table | ❌ No |
| Lead disappears from Recent-Leads page | ❌ No |
| Lead disappears from Manage-Contacts | ❌ No |
| Score / tier badge gets hidden | ❌ No (still rendered, score still updates) |
| `['campaignUsers']` / `['lead-profiles-batch']` / `['contacts']` invalidated | ❌ No |
| `user-plans` for that user invalidated | ✅ Yes |

So immediately after enrollment, the user shows up in **both worlds**: as a `LEAD` in audience-manager and as an enrolled student in manage-students.

### 12.4 The separate "mark converted" path

To actually move the lead out of the active-leads view, an admin must use the conversion controls in the **lead-profile drawer** ([student-lead-profile.tsx](src/routes/manage-students/students-list/-components/students-list/student-side-view/student-lead-profile/student-lead-profile.tsx)):

| Button | Endpoint | Effect |
|---|---|---|
| **Lead** | `POST …/user-lead-profile/update-status` (`UPDATE_LEAD_STATUS`) with `status='LEAD'` | Reverts to active-lead state; score updates resume |
| **Converted** | `UPDATE_LEAD_STATUS` with `status='CONVERTED'` (or `MARK_LEAD_CONVERTED`) | Sets `conversion_status='CONVERTED'`, stamps `converted_at`, freezes score updates, **hides the score badge** in Manage Contacts and other tables |
| **Lost** | `UPDATE_LEAD_STATUS` with `status='LOST'` | Marks the lead as lost |

Conversion is **reversible** — clicking **Lead** again flips it back to `LEAD` and unfreezes score updates. The `UserLeadProfile`, timeline, and communications history are **never deleted** on conversion; they are preserved so the audit trail (campaigns the user came from, notes, calls, demo attendance) survives.

### 12.5 Bulk paths via Admissions module

Two bulk endpoints exist that *do* combine lead capture with enrollment-adjacent flows, but they live under the Admissions module, **not** the audience-manager:

| Constant | URL | File |
|---|---|---|
| `BULK_SUBMIT_APPLICATION_WITH_LEAD` | `/admin-core-service/v1/applicant/bulk-apply` | [submit-application-bulk.ts](src/routes/admissions/-services/submit-application-bulk.ts) |
| `BULK_SUBMIT_ADMISSION_WITH_LEAD` | `/admin-core-service/v1/admission/bulk-submit-with-admission` | [submit-admission-bulk.ts](src/routes/admissions/-services/submit-admission-bulk.ts) |

These accept arrays of leads + target package-session and return a per-row success/failure summary. They handle the application/admission side of things; they are not invoked by `SimpleEnrollmentWizard`.

### 12.6 Cache keys to know

Anything that touches lead/enrollment state typically needs one or more of these invalidated:

- `['user-plans', userId]` — student's active plans (✅ invalidated by `enrollLearnerV2`)
- `['user-lead-profile', userId, instituteId]` — single lead profile
- `['lead-profiles-batch']` — batch profile fetch used by tables
- `['campaignUsers', campaignId, …]` — leads list per campaign
- `['user-audiences', userId]` — which campaigns this user belongs to
- `['cross-stage-timeline', userId, …]` — timeline / activity stream
- `['contacts']` — manage-contacts table

> If you change enrollment behavior to also mark conversion, also invalidate the lead profile + table query keys above so the UI reflects the new status without a manual refresh.

### 12.7 TL;DR

1. **Enroll = `POST /v2/learner/enroll`.** That's it. It only updates plans and invalidates `['user-plans']`.
2. **Convert = a separate manual click** in the lead-profile drawer that POSTs to `…/user-lead-profile/update-status` (or `mark-converted`).
3. The `UserLeadProfile`, timeline, and communications history are preserved across conversion; only score updates are frozen and the badge is hidden in most tables.
4. Conversion is reversible; bulk application/admission flows live in the Admissions module and are decoupled from the audience-manager UI.
