# Guardian / Parent–Child Architecture & Backfill Logic

Reference for the guardian-linking feature: how a parent/guardian user is
related to a student user, the primitives that live in **auth_service**, the
orchestration that lives in **admin_core_service**, and the institute-wide
backfill that synthesises guardians for students who don't have one.

> **Naming:** the data model and all backend identifiers say **parent**
> (`is_parent`, `linked_parent_id`, `PARENT_SETTING`, `ParentLinkController`).
> Every **user-facing** string says **guardian**. They are the same thing —
> "guardian" was only ever a UI rename, never a schema change.

---

## 1. Data model

### 1.1 Source of truth — `auth_service.users`

Two columns on the `users` table (added in
`auth_service/.../db/migration/V5__Add_parent_child_fields_to_users.sql`):

| Column | Type | Meaning |
|--------|------|---------|
| `is_parent` | `BOOLEAN DEFAULT FALSE` | This user IS a guardian (has ≥1 child). |
| `linked_parent_id` | `VARCHAR(255) NULL` | For a student: the `users.id` of their guardian. FK → `users(id) ON DELETE SET NULL`. |

Indexes (both partial):
- `idx_users_linked_parent_id` on `linked_parent_id WHERE linked_parent_id IS NOT NULL`
- `idx_users_is_parent` on `is_parent WHERE is_parent = TRUE`

The relationship is **one guardian → many students** (a guardian's
`is_parent = true`; each child carries that guardian's id in
`linked_parent_id`). There is no join table — the edge is the
`linked_parent_id` column on the child.

### 1.2 Denormalised pointer — `admin_core_service.student.guardian_user_id`

Added in `admin_core_service/.../db/migration/V377__Add_guardian_user_id_to_student.sql`:

```sql
ALTER TABLE student ADD COLUMN IF NOT EXISTS guardian_user_id VARCHAR(255) NULL;
CREATE INDEX IF NOT EXISTS idx_student_guardian_user_id ON student (guardian_user_id);
```

This is **not** the source of truth — it's a per-institute cache so
admin_core_service can answer *"which students in this institute still need a
guardian?"* (the backfill preview) and render a guardian-linked indicator
**without a cross-service call per student**. `ParentLinkService` keeps it in
sync on every successful link (see §3). If it ever drifts, the authoritative
`auth_service.users.linked_parent_id` still wins — the eligibility check always
falls back to it (§4.2).

---

## 2. auth_service primitives (the low-level API)

All under `auth_service/.../feature/auth/service/AuthService.java`, exposed as
internal HMAC endpoints on `UserController` (`/auth-service/v1/user/internal/...`).
admin_core_service reaches them through its own `features/auth_service/service/AuthService.java`
wrapper + route constants in `AuthServiceRoutes.java`.

| Primitive | Endpoint | Behaviour |
|-----------|----------|-----------|
| `linkParentChild(parentUserId, studentUserId)` | `POST /internal/link-parent-child` | Links two **existing** users. Back-fill only — sets `parent.is_parent=true` if not already, and `student.linked_parent_id` **only if currently blank** (never overwrites). |
| `getChildrenOfParent(parentUserId)` | `GET /internal/children-of-parent` | All children of one guardian (`findByLinkedParentIdIn`). Multi-child aware. |
| `createMultipleUsers([parent, child], instituteId, isNotify)` | `POST /internal/create-multiple-users` | Creates a **fresh** parent+child pair in one call. Requires **exactly 2** DTOs. Sets `is_parent`/`linked_parent_id` internally — no separate link call needed. Returns both DTOs **with password populated**. |
| `backfillParents(items, instituteId)` | `POST /internal/backfill-parents` | Institute-wide synthetic-guardian creation. See §4. |

### Idempotency / back-fill-only discipline

`linkParentChild` and `backfillParents` both **re-check `linked_parent_id` at
write time** and skip if it's already set. This makes re-runs safe even if the
caller's snapshot is stale — a student already linked is never re-linked or
double-created.

### Existing admission flow is untouched

`AdmissionService` (admin_core_service) already used `createMultipleUsers` +
`ParentWithChildDTO` + `users-with-children` for the enquiry/application
admission form **before** this feature. That path is **1-parent-to-1-child** and
is deliberately left as-is — the guardian feature adds new endpoints rather than
repurposing it. Don't fold them together: `users-with-children` still assumes one
child per parent.

---

## 3. admin_core_service orchestration — `ParentLinkService`

`admin_core_service/.../features/parent_link/service/ParentLinkService.java` is
the single orchestrator. `ParentLinkController` (`/admin-core-service/parent-link/v1`)
is a thin pass-through.

There are **three guardian-creation paths**, and all three do the same two
follow-ups after the auth_service call: (a) stamp `student.guardian_user_id`
locally, and (b) fire the credential notification (§5).

### 3.1 `link(ParentLinkActionRequestDTO)` — assignment-time link

Fired from the bulk-assign / add-learner dialog and side-view. `direction`
says which side the `anchorUserId` already is:

- `PARENT_ADDS_STUDENT` — anchor is the guardian; create/link a student under them.
- `STUDENT_ADDS_PARENT` — anchor is the student; create/link a guardian for them.

`mode` is `CREATE_NEW` (uniqueness-checked — blocks with an error on a duplicate
email/mobile, no auto-link, no override) or `LINK_EXISTING` (`existingUserId`
points at an already-existing user, no uniqueness check).

Returns `ParentLinkActionResponseDTO { studentUserId, parentUserId }` — the
caller enrols **`studentUserId`**, never the parent.

> A credential email is sent from here **only when a brand-new guardian is
> actually created** (i.e. `STUDENT_ADDS_PARENT` + `CREATE_NEW`). When this path
> creates a new *student* instead, that student's credentials are handled by the
> normal enrollment notification, not here.

### 3.2 `linkNewGuardian(NewGuardianLinkRequestDTO)` — brand-new guardian chip

Handles the one case `link()` can't: a manual chip in the assign dialog flagged
"is this a guardian?" that has **no user id yet**. The guardian is always
created fresh here; the student side is either created fresh
(`CREATE_NEW` → `createMultipleUsers`) or linked to an existing user
(`LINK_EXISTING` → `createUserFromAuthService` + `linkParentChild`). Both
branches notify.

### 3.3 `backfillGuardians` / `backfillLeadGuardians` — institute-wide backfill

See §4.

---

## 4. Backfill logic (the important part)

Two entry points, same machinery, different candidate source:

| Method | Candidate source | Reaches |
|--------|------------------|---------|
| `backfillGuardians(instituteId)` | **Enrolled students** — `ssigm.findDistinctUserIdsByInstituteAndStatus(instituteId, [ACTIVE])` | Students with an active enrollment row. |
| `backfillLeadGuardians(instituteId)` | **Leads** — `audienceResponseRepository.findDistinctStudentUserIdsByInstitute(instituteId)` | Leads that may never have been enrolled. |

Both feed their candidate id list into `computeEligibleFromUserIds(...)` and
then `runBackfill(...)`.

### 4.1 Chunking / scale

`runBackfill` processes **at most `BACKFILL_CHUNK_SIZE = 100` per HTTP call**, by
design, so one request can never run long enough to hit a reverse-proxy timeout
regardless of institute size. The **frontend loops**, calling the endpoint again
until nothing is left.

This is **self-correcting, not cursor-based**: eligibility is recomputed fresh on
every call, so a student processed in an earlier batch simply no longer appears
(their `linked_parent_id` is now set). No offset/page-token is threaded through
by the caller.

`BackfillSummaryDTO.totalEligible` is the **full outstanding count** as of that
call's snapshot (not just the batch), which is what lets the frontend show real
"X of Y done" progress across the whole loop.

For a 2000-student institute: ~20 sequential HTTP calls of 100 each. Frontend
loop cap `MAX_ROUNDS = 1000` is a stuck-loop backstop (covers 100,000+ students),
never expected to trigger.

### 4.2 Eligibility — EXCLUDE-list, never allow-list (bug-class to avoid)

`computeEligibleFromUserIds` is the subtle bit. Given a candidate id list it
returns those with no guardian and not themselves a guardian:

1. Pre-filter locally: `studentRepository.findByUserIdInAndGuardianUserIdIsNotNull(candidateIds)`
   returns the candidates **PROVEN** already-linked. **Subtract** those from the
   candidate set.
2. For whatever's left, ask auth_service the authoritative question
   (`getUsersFromAuthServiceByUserIds`) and keep only those where
   `linked_parent_id` is blank **and** `is_parent` is not true.

> **Why exclude-list and not allow-list — this was a real bug.** An earlier
> version used `findByUserIdInAndGuardianUserIdIsNull` (an *allow-list*: "keep
> only candidates whose local row shows guardian_user_id IS NULL"). That
> silently dropped every candidate with **no local `student` row at all** the
> moment the batch also contained even one candidate that *did* have a row.
> Leads frequently have no `student` row (it's created at enrollment), so new
> leads vanished from the preview/backfill whenever older enrolled candidates
> were also in scope. Subtracting only the PROVEN-linked ids can never do
> that — a missing local row falls through to the real auth_service check
> instead of being excluded.

### 4.3 Leads candidate query — two user columns (the second bug)

`audience_response` stores the "student side" user in **two different columns**
depending on capture flow:

- **Admission / enquiry-form leads** (`AdmissionService`, the enquiry-creation
  path in `AudienceService`): the applying guardian's own account goes in
  `user_id`, the child being applied for goes in `student_user_id`. Here
  `user_id` is ALREADY a guardian → exclude it; `student_user_id` is the
  candidate.
- **Every other (common) lead-capture path**: only `user_id` is set — the lead's
  own account IS the prospective student — and `student_user_id` stays NULL.

`findDistinctStudentUserIdsByInstitute` therefore **UNIONs both**:
`student_user_id WHERE student_user_id IS NOT NULL` **∪** `user_id WHERE user_id
IS NOT NULL AND student_user_id IS NULL`. Reading only `student_user_id` (the
original version) made ordinary leads invisible to the leads backfill. This
`user_id`-when-`student_user_id`-is-null fallback is the same idiom already used
throughout `AudienceResponseRepository`'s timeline-join queries.

### 4.4 Synthetic guardian shape

Per eligible student, `runBackfill` builds a `BackfillParentItemDTO`:

- `parentFullName = "<Student Name>'s Guardian"`
- `parentEmail = <random 10-char alnum>@vacademy.com`

`@vacademy.com` is deliberately an **unused, undeliverable placeholder domain** —
no real mail is ever sent there. This is why the credential-email recipient
choice matters (§5): for backfill you almost always want to notify the
**student's** real email, not the synthetic guardian address.

After auth_service returns, `runBackfill` stamps `student.guardian_user_id` for
each created pair and (if enabled) fires the credential notification using the
full detail returned in `BackfillCreatedPairDTO`.

### 4.5 Preview endpoints

`previewPendingGuardians` / `previewPendingLeadGuardians` run the **same
eligibility check** read-only, so the settings page can show admins exactly what
a run would touch before they confirm. ⚠️ **Preview is currently un-paginated** —
it computes eligibility for every candidate in one shot and returns the full
list (frontend slices the first 25 for display). At very large scale this is one
big auth_service round-trip per preview load; a candidate for chunking/capping if
it becomes a problem. (The actual *run* is already chunked; only preview is not.)

---

## 5. Credential email — routed through Template Settings

When a guardian account is created (any of the three paths), we optionally email
login credentials. This does **not** use a hardcoded Java email body — it goes
through admin_core_service's existing **Template Settings / notification-event-config**
system so admins can pick or edit the template.

### 5.1 Flow

1. **auth_service** does NOT send the email. `backfillParents` /
   `createMultipleUsers` just return full detail (guardian username, password,
   emails, names) — `BackfillCreatedPairDTO` carries this for backfill.
2. **admin_core_service** `DynamicNotificationService.sendGuardianAccountCreatedNotification(...)`
   resolves the EMAIL template bound to the `GUARDIAN_ACCOUNT_CREATED` event and
   dispatches via the unified-send path (notification_service does the actual
   `{{placeholder}}` substitution).
3. Template resolution is **institute-scoped config → `DEFAULT`-scoped config**
   fallback (mirrors `LiveClassTemplateService`). If no config exists at all, it's
   a silent no-op (logged).

### 5.2 Who receives it — `PARENT_SETTING` JSON

`ParentLinkService.readCredentialEmailConfig` reads the institute's
`PARENT_SETTING` blob (single source of truth, same one the settings page
writes):

- `sendCredentialEmail` (bool, default true) — send at all?
- `credentialRecipient` — `"STUDENT"` (default) or `"GUARDIAN"`.

`"STUDENT"` is the sane default for backfill (guardian email is the undeliverable
placeholder). `"GUARDIAN"` is meaningful for the link / add-guardian flows where
a real guardian email was entered.

### 5.3 Template binding — `notification_event_config`

`ParentLinkController` exposes:
- `GET  /parent-link/v1/credential-template?instituteId=` → current binding (`CredentialTemplateConfigDTO`).
- `POST /parent-link/v1/credential-template?instituteId=&templateId=` → **upserts** one
  institute-scoped `notification_event_config` row for `GUARDIAN_ACCOUNT_CREATED`
  / `INSTITUTE` / `EMAIL` (reactivates + repoints an existing row rather than
  inserting duplicates).

### 5.4 "Generate sample" template

There is **no Flyway-seeded default template**. Instead the Guardian Settings UI
has a **"Generate sample"** button (mirrors Invoice Settings) that creates an
editable starter template via the normal `POST /admin-core-service/institute/template/v1/create`
API (`createMessageTemplate`), then binds it. Frontend source of the sample HTML:
`frontend-admin-dashboard/src/routes/settings/-components/sample-guardian-credentials-template.ts`.

### 5.5 Placeholders available in the template

`{{user_full_name}}` (the recipient), `{{student_name}}`, `{{guardian_username}}`,
`{{guardian_password}}`, `{{institute_name}}`, `{{theme_color}}`, `{{portal_url}}`.
These come from `NotificationTemplateVariables` (reflection-converted to both
camelCase and snake_case keys by `SendUniqueLinkService`).

---

## 6. API reference

### admin_core_service — `/admin-core-service/parent-link/v1`

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/parent?studentUserId=` | The student's linked guardian (or null). |
| `GET`  | `/children?parentUserId=` | All children of a guardian. |
| `POST` | `/link` | Assignment-time link (`ParentLinkActionRequestDTO`). |
| `POST` | `/link-new-guardian` | Brand-new guardian chip (`NewGuardianLinkRequestDTO`). |
| `GET`  | `/backfill/pending?instituteId=` | Preview eligible **enrolled students**. |
| `POST` | `/backfill?instituteId=` | Run one backfill batch (enrolled). |
| `GET`  | `/backfill-leads/pending?instituteId=` | Preview eligible **leads**. |
| `POST` | `/backfill-leads?instituteId=` | Run one backfill batch (leads). |
| `GET`  | `/credential-template?instituteId=` | Current credential-email template binding. |
| `POST` | `/credential-template?instituteId=&templateId=` | Set/upsert the binding. |

### auth_service — `/auth-service/v1/user/internal` (HMAC-only)

| Method | Path |
|--------|------|
| `POST` | `/link-parent-child` |
| `GET`  | `/children-of-parent?parentUserId=` |
| `POST` | `/backfill-parents?instituteId=` |
| `POST` | `/create-multiple-users?instituteId=&isNotify=` |

---

## 7. Known gotchas & future work

- **`student.guardian_user_id` can be stale for never-enrolled students.** When
  `linkNewGuardian` creates a brand-new student, there's usually no local
  `student` row yet, so the `updateGuardianUserId` UPDATE is a no-op (not an
  error). The eligibility check falls back to auth_service's `linked_parent_id`,
  so they still won't be double-backfilled — only the local "which one is missed"
  view is momentarily incomplete for that edge case.
- **Preview is un-paginated (§4.5).** Fine today; revisit if an institute's
  candidate set gets huge.
- **Seat-limit counting can under-count** learners enrolled via SUBORG_LEARNER
  (they leave `ssigm.sub_org_id` null) — orthogonal to guardian linking but lives
  in the same student space; noted so a future change here doesn't assume the
  student roster is complete via SSIGM alone.
- **`PARENT_SETTING.enabled` master gate.** All guardian UI (bulk-assign toggle,
  side-view tab, backfill) is hidden institute-wide when this is false. Disabling
  hides UI without deleting existing links.
- **Where to extend:** a new guardian-creation path should reuse
  `ParentLinkService.notifyGuardianCreated(...)` + `updateGuardianUserId(...)`
  so the local pointer and credential email stay consistent with the other three
  paths. A new candidate source for backfill should feed
  `computeEligibleFromUserIds` (exclude-list semantics) — never re-introduce an
  allow-list pre-filter (§4.2).

---

## 8. Key files

**auth_service**
- `feature/auth/service/AuthService.java` — `linkParentChild`, `getChildrenOfParent`, `createMultipleUsers`, `backfillParents`
- `feature/user/controller/UserController.java` — internal endpoints
- `db/migration/V5__Add_parent_child_fields_to_users.sql` — `is_parent` / `linked_parent_id`

**common_service**
- `auth/dto/BackfillParentItemDTO.java`, `BackfillParentsResultDTO.java`, `BackfillCreatedPairDTO.java`, `ParentChildLinkRequestDTO.java`, `UserDTO.java`

**admin_core_service**
- `features/parent_link/service/ParentLinkService.java` — orchestrator
- `features/parent_link/controller/ParentLinkController.java` — endpoints
- `features/parent_link/dto/*` — request/response + `CredentialTemplateConfigDTO`
- `features/auth_service/service/AuthService.java` + `constants/AuthServiceRoutes.java` — HMAC wrappers
- `features/institute_learner/repository/InstituteStudentRepository.java` — `findByUserIdInAndGuardianUserIdIsNotNull`, `updateGuardianUserId`
- `features/institute_learner/repository/StudentSessionInstituteGroupMappingRepository.java` — `findDistinctUserIdsByInstituteAndStatus`
- `features/audience/repository/AudienceResponseRepository.java` — `findDistinctStudentUserIdsByInstitute` (the UNION)
- `features/notification/service/DynamicNotificationService.java` — `sendGuardianAccountCreatedNotification`
- `features/notification/enums/NotificationEventType.java` — `GUARDIAN_ACCOUNT_CREATED`
- `db/migration/V377__Add_guardian_user_id_to_student.sql` — denormalised pointer

**frontend-admin-dashboard**
- `routes/settings/-components/GuardianSettings.tsx` — settings page, backfill loop, template picker
- `routes/settings/-components/sample-guardian-credentials-template.ts` — "Generate sample" HTML
- `components/templates/TemplateSelector.tsx` — reused template dropdown
