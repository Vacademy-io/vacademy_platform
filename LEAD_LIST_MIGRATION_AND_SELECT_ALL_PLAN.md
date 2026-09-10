# Lead-list migration + select-all fix — implementation plan

Two independent pieces of work, planned together because they share the bulk-action
surface on the leads tables.

- **Part A** — fix "select all" failing on Recent Leads / Campaign Users. **IMPLEMENTED** (A1, A2,
  A4 + the assign-dialog cap). A3 (write-path batching) is still open.
- **Part B** — new feature: migrate leads from one lead list to another. **PLANNED, not built.**

## Status

| Step | State |
|---|---|
| A1 ids-only endpoint (`POST /v1/audience/leads/ids`) | done |
| A2 cap `size`, chunk the auth_service fan-out | done |
| A4 frontend rewire, shared filter body, real errors, `truncated` | done |
| Assign-dialog preview cap (regression guard for A1) | done |
| B1-B5 migrate leads between lists (incl. V502) | done |
| A3 write-path batching (`CounsellorReassignService`, `deleteLeads`) | **open** |

Backend compiles; frontend typechecks; `design-lint` reports 0 errors. Nothing has been run
against a database — the ids endpoint and the migration have not been exercised for real.

## What the use-case pass changed

Two findings from tracing the schedulers moved this from "update a column" to something that
needed real guards. Both are recorded here because they are not obvious from the code around the
move itself.

### 1. Opt-out is a lead list, so migration could silently re-subscribe people

`AudienceOptOutService.moveUserToOptOutAudience` implements opting out by moving the person's
response **into** the institute's opt-out audience (`campaign_type LIKE '%OPT_OUT%'`) and stamping
`overall_status = 'OPTED_OUT'` on the row it replaced.

The consequence is easy to miss: the row now sitting *in* the opt-out list carries **no** flag of
its own — the flag stayed behind on the old row. So a bare `audience_id` update moving that list's
rows into a marketing list re-subscribes those people immediately, past every suppression
predicate in the codebase. Three guards, all in `migrateLeads`:

- refuse a migration whose **target** is the opt-out list (that is `AudienceOptOutService`'s job,
  and it also copies custom fields and fires the opt-out workflow);
- skip any lead whose **source** is the opt-out list (`IN_OPT_OUT_LIST`);
- skip any row flagged `OPTED_OUT` (`OPTED_OUT`).

### 2. There is no per-lead "already sent" marker anywhere in the workflow engine

Audience drips select on `audience_id` **plus** a date window over `workflow_activate_day_at`, and
that anchor is computed only at insert (`calculateWorkflowActivateDayAt`, 7 creation call sites,
never on update). The only idempotency in the engine is per schedule slot, and the only send-level
dedupe is in-memory within a single execution. So moving a row:

- makes it instantly visible to the target list's workflows;
- leaves a **stale** anchor, so an older lead matches no window and silently drops out of the drip
  entirely, while a recent one lands mid-sequence at whatever day-N happens to match;
- can **re-send** if the target has a workflow at the same `daysAgo` the source already ran today.

That makes the anchor a real decision, not an implementation detail, so it is an explicit request
field (`workflow_anchor`) surfaced in the dialog:

- `PRESERVE` (**default**) — keep the anchor; no outreach is triggered. Misroute, archive, junk.
- `RESET_TO_TARGET` — re-anchor from the target's `workflow_setting.offset_day`, entering its drip
  at day zero. Re-engagement. **This sends messages**, so the dialog warns before committing.

Default is `PRESERVE` because the failure mode of the wrong default is messaging real people.

## Use cases this was designed against

| # | Use case | What it needs |
|---|---|---|
| 1 | Misrouted intake (form webhook on the wrong list) | move + `PRESERVE` |
| 2 | Merging lists ("FB Jan" + "FB Feb" → "FB Q1") | move + tolerant collision handling |
| 3 | Promotion after qualification → "Sales Qualified" | move; counsellor stays (it is per person, not per list) |
| 4 | Wrong course/product | move + `PRESERVE` |
| 5 | Re-engagement → "Win-back" list | move + `RESET_TO_TARGET` |
| 6 | Archive to "Cold" instead of deleting | move + `PRESERVE` |
| 7 | Junk quarantine | move + `PRESERVE` |

## Known gaps / deliberate v1 limits

- **Merging leaves residue.** For use case 2, collisions are skipped, which leaves those rows in
  the *source* list — so the source never empties and cannot be retired, which is the point of a
  merge. The existing `markDuplicate(dup, primary, sourceType)` mechanism (sets `is_duplicate` /
  `primary_response_id`, logs `DUPLICATE_MERGED`) is the right tool for this, as an opt-in
  `on_duplicate: SKIP | MARK_DUPLICATE`. Not built: silently marking rows duplicate is too
  destructive to be the default, and it deserves its own decision.
- **`InactivityOptOutScanner` is scoped by an audience allowlist.** Moving a lead out of a
  configured list silently exempts it from auto-opt-out; moving one in subjects it. Correct
  either way, but it is a behaviour change an admin will not anticipate.
- **TAT/SLA reminder state does not reset** on a move (`tat_reminder_dedup_key` is keyed by lead +
  counsellor + stage, not audience), so reminders continue uninterrupted. The resolved `poolId`
  does change to the target's, so pool-scoped workflows follow the new list.
- **Pre-existing bug, unrelated to this work but adjacent:** `findActiveByAudienceId` — used by AI
  call campaigns (`AiCallCampaignService`) and the manual blast (`sendAudienceMessage`) — filters
  only `audience_status = 'ACTIVE'` and does **not** exclude `overall_status = 'OPTED_OUT'`, unlike
  the workflow query. Opted-out leads are therefore already dialable and messageable through those
  two paths. Worth fixing separately.

---

## Background: what a "lead list" actually is

There is no `LeadList` entity. A **lead list = an `audience` row** (the code calls them
"campaigns"; the Javadoc in `LeadDedupSettingService` and `LeadDeduplicationService` calls
them "lead lists"). A **lead = an `audience_response` row**, attached to its list by the plain
`audience_response.audience_id` column — no join table.

So a migration is fundamentally a single-column `UPDATE`. The work is in the invariants
that hang off that column.

### Deduplication, as it exists today

Stored as JSON, not a table: `institute.setting → setting → LEAD_SETTING → data → dedup`,
read at `LeadDedupSettingService.java:108`, Caffeine-cached 5 min.

| Enum | Values |
|---|---|
| `DedupField` | `EMAIL`, `PHONE` |
| `DedupScope` | `CAMPAIGN` (this list only), `SELECTED` (a named set of lists), `INSTITUTE` |
| `DedupAction` | `REJECT`, `ALLOW_REASSIGN` |

Enforced by `LeadDeduplicationService.checkDuplicate(instituteId, audienceId, email, phone, excludeResponseId)`
(`LeadDeduplicationService.java:130`) from 8 intake call sites in `AudienceService`. PHONE
matches on last-10-digits; EMAIL on trim + lowercase. All 6 backing predicates
(`AudienceResponseRepository.java:1672-1766`) exclude `is_duplicate` and `OPTED_OUT` rows.

This matters for Part B because **dedup is scoped per list**: a lead that is unique in list A
may collide once moved into list B.

---

# Part A — fix "select all"

## Root cause

`selectAllAcrossPages` in both tables refetches the entire filtered table through the
heaviest read endpoint in the feature:

- `recent-leads-page.tsx:699-750`
- `campaign-users-table.tsx:620-646`

```ts
const res = await fetchRecentLeads({ ...filters, page: 0, size: totalElements });
```

Normal page size is 20. `size: totalElements` asks for every matching row at once, and
`AudienceService.getLeads` applies **no cap on `size`** (`AudienceService.java:2747-2750`).
That full page then goes through `mapResponsesToLeadDetails` (`AudienceService.java:3139-3230`),
which for N rows performs:

| Line | Work |
|---|---|
| 3147-3150 | `authService.getUsersFromAuthServiceByUserIds(...)` — one HMAC POST to auth_service with **every** user id, **unchunked** (`AuthService.java:62-80`) |
| 3153-3155 | `leadScoreRepository.findByAudienceResponseIdIn(responseIds)` |
| 3191-3194 | `findCounselorActionsByResponseIds(responseIds)` |
| 3212-3218 | `leadFollowupRepository.findOpenByAudienceResponseIds(responseIds)` |
| 3225-3227 | `linkedUsersRepository.findBySourceAndSourceIdIn("ENQUIRY", enquiryIds)` |

…to produce exactly three fields the UI keeps: `responseId`, `userId`, `name`.

The cross-service call is the first thing to break (internal HTTP timeout); past ~65 535 bind
parameters the `IN` lists fail at the JDBC layer. Because it scales with `totalElements`, the
failure is size-dependent — hence "sometimes".

The reason is then thrown away:

```ts
} catch { toast.error(t('toasts.selectAllFailed')); }
```

## Two correctness bugs found alongside it

1. **Select-all can select a different set than the one on screen.** `recent-leads-page.tsx:706-731`
   rebuilds the filter payload by hand instead of reusing the paginated query's payload
   (`:541-568`), and drops `sort_by` / `sort_direction`. Any filter added to one and not the
   other silently diverges.
2. **Stale ids survive a filter change.** Selection is cleared only when `counsellorFilters`
   changes (`recent-leads-page.tsx:670-672`, `campaign-users-table.tsx:591-593`). Change the
   status/date/search filter and previously-selected ids stay in the Map, then get submitted
   to a bulk action.

## Fix

### A1. New lightweight ids-only endpoint

```
POST /admin-core-service/v1/audience/leads/ids
body: LeadFilterDTO        (identical to POST /leads — same filters, same scoping)
->    { "content": [ { "response_id": "...", "user_id": "...", "name": "..." } ],
        "total": 12873, "truncated": false }
```

- Reuses the **same** filter queries as `getLeads` (`findInstituteLeadsWithFilters` /
  `findLeadsWithFilters`, `AudienceService.java:3006-3070`) so the selected set always matches
  the visible set.
- Skips `mapResponsesToLeadDetails` entirely: **no auth_service call**, none of the five joins.
- `name` comes from the `audience_response` row itself (`parent_name` / existing name columns),
  not auth_service. It is display-only, used for the assign dialog's label column.
- Hard cap (`MAX_SELECT_ALL = 20000`) with `truncated: true` when exceeded, so the UI can say
  "first 20 000 selected" rather than silently selecting a partial set.

### A2. Backend hardening (needed regardless of A1)

- Cap `size` in `AudienceService.getLeads:2748` — clamp to a sane max (e.g. 500). Nothing
  legitimate asks for more; today one client can ask for the whole table.
- Chunk `AuthService.getUsersFromAuthServiceByUserIds` (`AuthService.java:62-80`) into batches
  of ~500 and concatenate. This is called from several places, all currently unbounded.
- Chunk the `IN` lists in `mapResponsesToLeadDetails` on the same batch size.

### A3. Write-path batching — the failure immediately behind this one

Fixing select-all makes the *selection* work; the bulk **action** on 20k rows still fails.

- `CounsellorReassignService.planAndApplyAssign` (`:147-183`) loops per lead, doing
  `profileService.assignCounselor(...)` + `timelineEventService.logJourneyEvent(...)` — 2+
  writes per lead inside a single `@Transactional`. At thousands of rows this outlives
  `spring.datasource.hikari.connection-timeout=60000` (`application.properties:28`) and starves
  the pool.
- `AudienceService.deleteLeads` (`:3514-3541`) does three queries per lead (`isConverted` lookup,
  `save`, timeline event) in one transaction.

Fix: chunk both into batches (e.g. 500) committed per batch, and hoist the per-lead
`isConverted` lookup into one batched query. For batches over a threshold, return `202` and
run on a background pool — the pattern already exists in `AiCallCampaignController` /
its service, which paces work server-side.

### A4. Frontend

- Point both `selectAllAcrossPages` at the new `/leads/ids` endpoint.
- **Recent Leads**: reuse the existing query payload object rather than rebuilding it, so
  sort and any future filter cannot diverge.
- Clear `selectedLeads` on **every** filter change, not just `counsellorFilters`.
- Replace the bare `catch` with the real server message, so the next failure is diagnosable.
- Surface `truncated` in the selection banner.
- **Assign dialog** (`bulk-assign-counsellor-dialog.tsx:376-402`) renders one `<Select>` per
  lead. At 20k that hangs the tab before any request is sent. In `SINGLE` / `ROUND_ROBIN` /
  `REMOVE` mode the per-row list is not needed at all — collapse it to a summary count above a
  threshold and keep the per-row table only for `MANUAL` (itself capped).

## Explicitly not doing: full filter-mode

The alternative is `{ allSelected, filter, excludedIds }` on the wire, with the backend
resolving ids server-side. It is the cleaner contract, but it is **not** the binding
constraint: an ids-only payload is ~120 bytes/row (20k rows ≈ 2.4 MB, fine), and filter-mode
would not fix A3, which is where the remaining failures live. Revisit once A1-A3 are in.

---

# Part B — migrate leads between lead lists

**Decisions taken:** move (not copy); **provenance preserved**; colliding leads **skipped**,
the rest migrated (partial success).

## B1. What has to move with the row

Most of the lead graph is keyed by `audience_response_id` and therefore follows the row for
free — `lead_status_history`, `lead_followup`, `timeline_event`, `telephony_call_log`
(`response_id`), `engagement_member`, enquiry links.

Three things do **not**, because they denormalise `audience_id`:

| What | Where | Handling |
|---|---|---|
| `lead_score.audience_id` | `LeadScore.java:31`, `NOT NULL` | **Must** be updated in the same transaction or scores are mis-attributed to the old list. |
| `audience_response.initial_score` | `AudienceResponse.java:138-140`, a snapshot of the source `audience.default_initial_score` taken at `AudienceService.java:1175` | **Keep the original.** Re-snapshotting would silently rescore historical leads on a move. |
| `audience_response.workflow_activate_day_at` | derived from the source audience's `workflow_setting.offset_day` | **Keep.** Recomputing could re-fire drip workflows for leads that already received them. |

Both "keep" decisions are deliberate and will be commented in the code — a move is a
curation action, not a re-intake.

## B2. Provenance

Two mechanisms, because they answer different questions:

1. **Full chain — timeline event.** New `LeadJourneyActionType.LEAD_LIST_CHANGED` (the enum
   currently has no move/migrate value), logged through the existing `logLeadCurationEvent`
   (`AudienceService.java:3658`) with metadata `from_audience_id`, `from_campaign_name`,
   `to_audience_id`, `to_campaign_name`, `actor`. Renders in the lead journey view with no new
   UI, and records *every* move, so "which list was it in before" is always answerable.
2. **Queryable origin — one new column.** `audience_response.original_audience_id`, written
   only on the **first** move and never overwritten. The timeline is not efficiently
   queryable; this keeps "leads that originally came from campaign X" a plain indexed SQL
   filter after a reorg.

### Migration `V502__add_original_audience_id_to_audience_response.sql`

```sql
ALTER TABLE audience_response ADD COLUMN IF NOT EXISTS original_audience_id TEXT;
CREATE INDEX IF NOT EXISTS idx_audience_response_original_audience_id
    ON audience_response(original_audience_id) WHERE original_audience_id IS NOT NULL;
COMMENT ON COLUMN audience_response.original_audience_id IS
    'The audience (lead list) this response was first created in. Set on the FIRST migration only, never overwritten. NULL = never migrated.';
```

No backfill: `NULL` correctly means "never moved, `audience_id` is still the original".

## B3. Skip rules (partial success)

A lead is **skipped**, not failed, when:

| Reason code | Condition |
|---|---|
| `ALREADY_IN_TARGET_LIST` | `audience_id` already equals the target — idempotent no-op |
| `DUPLICATE_USER_IN_TARGET` | `existsByAudienceIdAndUserId(targetAudienceId, userId)` — the one-response-per-person-per-list invariant the intake guards rely on (`AudienceService.java:1155`, `:1692`, `:4522`). Note this is a **code** guard, not a DB constraint — verified: no unique index on `(audience_id, user_id)` — so it must be checked explicitly. |
| `DUPLICATE_IN_TARGET` | `leadDeduplicationService.checkDuplicate(instituteId, targetAudienceId, email, phone, responseId)` returns `REJECT` under the institute's setting. `excludeResponseId` is passed so the row cannot match itself. |
| `LEAD_CONVERTED` | converted leads are not moved, mirroring `deleteLeads` |

`ALLOW_REASSIGN` is treated as "let it through" — the admin is acting deliberately, and the
repeat-lead counsellor/status rules are an *intake* concern, not a curation one.

Everything else migrates. Response:

```json
{ "migrated": 1187,
  "skipped": [ { "response_id": "r9",  "reason": "ALREADY_IN_TARGET_LIST" },
               { "response_id": "r14", "reason": "DUPLICATE_IN_TARGET",
                 "detail": "A lead with this phone number already exists in this lead list." } ] }
```

Shape follows `BulkSubmitLeadResponseDTO` / `BulkSubmitLeadResultItemDTO`, the existing
partial-success precedent.

## B4. Endpoint

Modelled directly on `POST /leads/delete`:

```
POST /admin-core-service/v1/audience/leads/migrate
{ "response_ids": [...], "target_audience_id": "...", "institute_id": "...", "scope": "RESPONSE" }
```

- `MigrateLeadsRequestDTO` — `@JsonNaming(SnakeCaseStrategy.class)`, same as `LeadDeleteRequestDTO`.
- `AudienceService.migrateLeads(MigrateLeadsRequestDTO, CustomUserDetails)`, `@Transactional`,
  chunked per A3.
- **Authorization and tenancy reuse `resolveDeleteTargets`' pattern exactly**
  (`AudienceService.java:3607-3644`): require `instituteId`, `hasAdminRole(actor, instituteId)`
  → `ForbiddenException`, then resolve rows **through the institute** via
  `findAllByInstituteAndIds` and 404 on any count mismatch. Resolving by raw id would let an
  admin pass their own `institute_id` with another tenant's response ids.
- **Additionally (CONFIRMED)**: the target audience **must** belong to the same
  `institute_id` as the request. `resolveDeleteTargets` only proves the caller administers the
  institute they named and that the *source* rows belong to it — it says nothing about the
  destination. Without this check a well-formed request from a legitimate admin moves their own
  leads into another tenant's list. Resolve the target as
  `audienceRepository.findById(targetAudienceId)` and reject unless its `institute_id` equals
  `request.getInstituteId()`, with the same deliberately-vague `ResourceNotFoundException`
  ("Lead list not found") used elsewhere, so the response cannot be used to probe for the
  existence of another tenant's lists. This is a new check with no precedent in delete, and is
  the main security-relevant addition.
- `scope: "USER"` supported for symmetry (move every lead this person holds).

## B5. Frontend

- "Move to another list" in the bulk-actions dropdown alongside assign / unassign / delete
  (`campaign-users-table.tsx:~1330-1370`, mirrored in `recent-leads-page.tsx:1623-1642`),
  admin-gated via the existing `isAdminForInstitute`.
- New shared `components/shared/leads/migrate-leads-dialog.tsx`, following
  `delete-leads-dialog.tsx`: target-list picker (audiences for this institute, source excluded),
  confirmation count, then a result summary listing skipped leads with their reasons.
- New service `routes/audience-manager/list/-services/migrate-audience-leads.ts`, following
  `delete-audience-lead.ts:19-36`.
- On success invalidate `recent-leads`, `campaign-users`, `user-lead-profile`,
  `lead-profiles-batch` (same set as `handleStatusUpdated`).

---

## Suggested order

1. **A2** backend hardening (cap `size`, chunk auth_service + `IN` lists) — smallest change,
   independently valuable, stops the bleeding.
2. **A1 + A4** ids endpoint + frontend rewire — closes the reported bug.
3. **A3** write-path batching — unblocks bulk actions at real select-all scale.
4. **B1-B4** migrate backend + `V502`.
5. **B5** migrate UI.

Steps 1-3 are the reported bug; 4-5 are the new feature. They can ship separately.

## Open items to confirm during implementation

- Exact `name` source on `audience_response` for the ids endpoint (`parent_name` vs a
  full-name column) — to be read off the entity rather than assumed.
- Whether `sub_org_id` equality should be *required* between source and target lists or only
  warned on. Defaulting to required, as the stricter choice.
