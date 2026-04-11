# Custom Fields — Admin User Flows & Known Issues

> Companion to [CUSTOM_FIELDS.md](CUSTOM_FIELDS.md). This document is **not** about the code — it walks through what an admin actually does in the dashboard, what they should expect at each step, and the bugs / UX gotchas they will hit along the way.
>
> Read this if you are: an admin user who needs to understand the product, a PM scoping changes to custom fields, a QA writing test cases, or an engineer triaging custom-field bugs.

---

## Table of Contents

1. [Mental Model in 60 Seconds](#1-mental-model-in-60-seconds)
2. [Actors & Permissions](#2-actors--permissions)
3. [User Flows](#3-user-flows)
   - [3.1 First-Time Institute Setup (auto)](#31-first-time-institute-setup-auto)
   - [3.2 Settings → Custom Fields tab — opening it](#32-settings--custom-fields-tab--opening-it)
   - [3.3 Add a brand-new custom field](#33-add-a-brand-new-custom-field)
   - [3.4 Edit field name, type, or options](#34-edit-field-name-type-or-options)
   - [3.5 Toggle visibility per location](#35-toggle-visibility-per-location)
   - [3.6 Mark a field required / optional](#36-mark-a-field-required--optional)
   - [3.7 Reorder & group fields](#37-reorder--group-fields)
   - [3.8 Delete a field](#38-delete-a-field)
   - [3.9 Rename a "fixed" system field](#39-rename-a-fixed-system-field)
   - [3.10 Create an Invite that uses custom fields](#310-create-an-invite-that-uses-custom-fields)
   - [3.11 Create an Audience / Campaign with custom fields](#311-create-an-audience--campaign-with-custom-fields)
   - [3.12 Schedule a Live Class with guest custom fields](#312-schedule-a-live-class-with-guest-custom-fields)
   - [3.13 Create an Assessment with registration custom fields](#313-create-an-assessment-with-registration-custom-fields)
   - [3.14 View custom field answers in the Learner list / profile](#314-view-custom-field-answers-in-the-learner-list--profile)
   - [3.15 System ↔ Custom Field mapping](#315-system--custom-field-mapping)
4. [Known Bugs & Issues](#4-known-bugs--issues)
   - [4.1 Critical](#41-critical)
   - [4.2 High](#42-high)
   - [4.3 Medium](#43-medium)
   - [4.4 Low / Cosmetic](#44-low--cosmetic)
5. [UX Gotchas (not bugs, but surprising)](#5-ux-gotchas-not-bugs-but-surprising)
6. [Recommended Improvements](#6-recommended-improvements)
7. [Test Checklist for QA](#7-test-checklist-for-qa)

---

## 1. Mental Model in 60 Seconds

A custom field is an **answer slot** that the institute defines once and then re-uses everywhere it collects data. It has:

- A **name** ("University ID") and **type** (text / number / dropdown).
- A list of **locations** where it shows up — Invite form, Audience campaign, Live Class registration, Assessment registration, Learner Profile, Learner List, Enquiry form, Enroll Request List, Learner Enrollment.
- A **required** flag and an **order**.
- Optionally, a **group** it belongs to (visual grouping in forms).

When a learner fills the field anywhere, the answer is stored against (learner, field, context), so the same "Phone Number" field can hold a different value for an enroll invite vs. a live class — but in practice the platform usually shows the most recent value as canonical.

Three default fields — **Full Name**, **Email**, **Phone Number** — are pre-created the moment the institute is provisioned. They are locked: an admin can rename/move/visibility-toggle them, but cannot delete them or change their type.

---

## 2. Actors & Permissions

| Actor | Can do |
|-------|--------|
| **Root admin / Admin** | Open Settings → Custom Fields, create/edit/delete fields, toggle visibility, configure system mappings, edit any feature (Invite, Audience, Live Class, Assessment) and add per-feature custom fields. |
| **Teacher / Faculty** | Use existing custom fields when creating their own assessments/live sessions. Cannot manage the institute-wide field catalog. |
| **Learner** | Sees and fills the fields on the public forms. Has no awareness of the configuration. |

There is currently **no granular role** that can read but not modify the custom field catalog.

---

## 3. User Flows

Each flow below is written as: *what the admin does → what the system does → what the admin sees → what to watch out for*.

### 3.1 First-Time Institute Setup (auto)

**Trigger:** A new institute is created (via super-admin or signup).

**What happens automatically:**
1. The platform inserts three master rows (Full Name, Email, Phone Number) into the field catalog.
2. It links them to the new institute as `DEFAULT_CUSTOM_FIELD` mappings, all marked compulsory.
3. It writes a `CUSTOM_FIELD_SETTING` JSON document into the institute settings, marking these three fields as visible in **every** location.

**What the admin sees on first login:** when they open Settings → Custom Fields, the three default fields are already there, locked (no delete/rename), all checkboxes ticked, and listed in order Name → Email → Phone.

**Watch out:**
- The default fields are inserted with `is_mandatory=false` on the master row but listed in the `compulsoryCustomFields` array. The "required" star you see in the UI comes from the array, not the master row → see [Bug B-2](#b-2-default-fields-have-inconsistent-required-state).
- If the institute creation runs partially (e.g. setting save fails), the relational rows still exist but the JSON blob may not — the admin will see *no* default fields in Settings until they save once. See [Bug B-3](#b-3-partial-failure-during-institute-bootstrap).

### 3.2 Settings → Custom Fields tab — opening it

> **First-time confusion warning.** The table on this page shows **four logical buckets** mixed together — System Fields (renameable label list), "Fixed" custom fields (the ones the UI shows with a "System Field" badge), regular custom fields, and grouped fields. The "System Field" badge does **not** come from the backend — the frontend decides which rows get it by name‑matching against a hardcoded list `['name','email','username','password','batch','phone']` (see [Bug B-24](#b-24-system-field-badge-is-decided-by-a-frontend-name-match-heuristic)). Two consequences:
> - Default seeded fields named `Full Name` and `Phone Number` do **not** match the heuristic, so they appear without the badge and look fully editable even though the backend marked them locked.
> - Any legacy `custom_fields` row with `field_name = 'name' / 'username' / 'password' / 'batch'` will appear here with the badge, even though it is a perfectly normal user-created row.
>
> If you see duplicates (e.g. two `email` rows), you have hit [Bug B-0](#b-0-the-settings-page-shows-duplicate-fields-and-misclassified-system-fields) — run the diagnostic SQL there.

**Steps:**
1. Click the gear icon → **Settings**.
2. Click the **Custom Fields** tab.

**What happens behind the scenes:**
1. The dashboard checks `localStorage` for a 24-hour-cached copy of the settings.
2. If the cache is fresh, it renders instantly from cache.
3. Otherwise it fetches the institute settings document, transforms it into the UI shape, and writes the cache.

**What the admin sees:** four sections —
- **System Fields** — the renameable hardcoded list (Gender, Address, City, …).
- **Fixed Fields** — Name/Email/Phone (locked).
- **Custom Fields** — anything the admin previously added.
- **Field Groups** — collapsible groups, with the fields that belong to them.

Each row has 9 visibility checkboxes (one per location), a required toggle, an edit/delete button, and a drag handle.

**Watch out:**
- The **24-hour cache** means a coworker who saved a new field 5 minutes ago will *not* show up in your tab until the cache expires or you do a hard refresh. See [Bug B-7](#b-7-stale-24h-cache-across-admin-sessions).
- There is no explicit "refresh" button. A page reload re-uses the cache; you have to clear `localStorage` or wait it out.

### 3.3 Add a brand-new custom field

**Steps:**
1. In Settings → Custom Fields, click **+ Add Custom Field** at the bottom of the Custom Fields section.
2. Type a name, e.g. *"University ID"*.
3. Pick a type: **Text** / **Dropdown** / **Number**.
4. If Dropdown, add options one by one. Each option needs a non-empty value.
5. Tick the **locations** where it should appear (Invite List, Learner Profile, …).
6. Optionally tick **Required**.
7. Click **Save Changes** at the top right.

**What happens behind the scenes:**
1. A temporary frontend ID (`temp_<timestamp>`) is assigned so React can render the new row before the backend save.
2. On Save, the entire settings document is POSTed to `/admin-core-service/institute/v1/custom-field/create-or-update` with `isPresent=true`.
3. Backend generates a snake-case key like `university_id_inst_<instituteId>`, takes a row-level lock to ensure no duplicate, inserts a new row in the master field catalog, and inserts an institute mapping.
4. Cache is overwritten with the new payload and the new field now has a real UUID.

**What the admin sees:** the row's temporary id is replaced by the real UUID; the row stays where it was placed; a green "Settings saved" toast appears.

**Watch out:**
- **Don't include emojis or unicode in the name** — the key generator strips everything that isn't `[a-zA-Z0-9_]`. *"Phone 📱"* and *"Phone"* both produce the same key and the second save will silently re-use the first field. See [Bug B-9](#b-9-key-generator-strips-unicode-causing-silent-collisions).
- **A field whose name contains "mail" or "phone" will be rendered as an email/phone input on the learner side**, even if it has nothing to do with email/phone. Naming a field *"Postal mail address"* will produce an email input on the learner form. See [Bug B-4](#b-4-emailphone-renderer-is-inferred-from-the-field-name).
- **If you previously deleted a field with the same name and try to add it back**, you'll likely hit an error because the soft-deleted master row still occupies the unique-key slot. See [Bug B-1](#b-1-cannot-recreate-a-field-after-soft-delete).

### 3.4 Edit field name, type, or options

**Steps:**
1. Click the **pencil icon** on a custom field row.
2. Change name, type, or dropdown options.
3. Save.

**What happens behind the scenes:** The save POST sends the **entire** settings blob, not just the changed field. The backend updates the master row in place and rewrites the JSON blob.

**Watch out:**
- **Renaming does NOT regenerate the key.** If you rename *"Phone Number"* → *"Mobile Number"*, the underlying key stays `phone_number_inst_<id>`. This still works for storage but:
   - Any logging / debugging that uses the key will show the old name.
   - The PHONE-renderer inference (which looks at the key) still treats it as a phone field — fine in this case but confusing if you rename in a way that changes intent. See [Bug B-5](#b-5-key-stays-frozen-when-name-changes).
- **Changing type from text to dropdown does not migrate existing answers.** Old text values remain in the database; the learner UI may render them oddly because they aren't in the option list.
- **Removing dropdown options does not delete answers** that already used those options. Learners with the old value will see a blank dropdown when they re-open the form.

### 3.5 Toggle visibility per location

**Steps:**
1. Click a location checkbox (e.g. *Invite List*) on the row of an existing field.
2. Save.

**What happens:** The `locations` array on that field's record is updated. Next time the corresponding feature loads (Invite dialog, Audience form, …), the field will appear or disappear from that form.

**Watch out:**
- **Existing learner answers are not deleted** when you untick a location. They stay in the database; only the form display changes. If you re-tick later, the old values come back.
- **Required-ness is global, not per location.** If you mark a field required, it is required everywhere it is visible. There is no "required in Invite, optional in Profile". See [Bug B-10](#b-10-required-flag-cannot-vary-per-location).
- **The cache makes this look broken in other tabs.** A coworker may not see your visibility change until their cache expires. See [Bug B-7](#b-7-stale-24h-cache-across-admin-sessions).

### 3.6 Mark a field required / optional

**Steps:** Toggle the **Required** switch on the row.

**What happens:** The field id is added to / removed from the `compulsoryCustomFields` array in the JSON blob.

**Watch out:**
- For default fields (Name/Email/Phone), the toggle is wired but the underlying master row stays `is_mandatory=false`. The required-ness is enforced only via the JSON blob's compulsory list. If any backend code path reads `is_mandatory` from the master row, it will see "false". See [Bug B-2](#b-2-default-fields-have-inconsistent-required-state).
- The **Invite form already has its own copy** of these defaults from when the invite was created. Toggling required in Settings does **not** retroactively change existing invites. New invites created after will pick up the new state.

### 3.7 Reorder & group fields

**Steps:**
1. Drag a field row by its handle.
2. Drop it where you want it.
3. To create a group, drag a field over another field labeled as a group, or use *"+ Add Group"*.
4. Save.

**What happens:** Each field's `individual_order` (for ungrouped) or `group_internal_order` (for grouped) is recomputed and persisted.

**Watch out:**
- **Reordering a default field shuffles the others** — the renumbering is sequential; saving after a drag updates every affected row, which means a save can touch many records even if you only moved one.
- **Groups are visual only.** The learner-side form renders fields in their group order, but there is no group "header" rendered in some flows (Invite, in particular). The grouping looks meaningful in Settings and may not look meaningful to the learner. See [Bug B-13](#b-13-groups-are-not-visually-rendered-in-all-flows).

### 3.8 Delete a field

**Steps:** Click the trash icon on a custom field. Confirm. Save.

**What happens:** The institute mapping is **soft-deleted** (status set to `DELETED`). The master row in the field catalog stays. The field's existing answers in `custom_field_values` are **not** touched.

**Watch out:**
- **The list of fields with usage counts does not always reflect deletion immediately** — the Custom Fields list-with-usage endpoint only filters mapping status, so a recently deleted field disappears from usage counts but the answers remain orphaned in the database.
- **You cannot recreate a field with the same name** because the master row (which holds the unique key) is still there with a status that the create path doesn't notice. See [Bug B-1](#b-1-cannot-recreate-a-field-after-soft-delete).
- **Learners' old answers are still queryable** by anyone who knows the field UUID. Sensitive fields (e.g. ID number) are not actually purged.

### 3.9 Rename a "fixed" system field

System fields (Gender, Address, …) live in the *System Fields* section. They have a **rename** affordance only.

**Steps:** Click the pencil → type a new label → Save.

**What happens:** The `customValue` field on the corresponding `fixedFieldRenameDtos` entry is updated. The underlying database column name doesn't change — only the label shown to learners.

**Watch out:**
- **If you rename "Gender" to "Sex"**, the platform will display *Sex* on every form, but the backend column remains `gender`. Reports/exports may still show *Gender*. There is no central place where the rename is applied to exports.
- **Some system fields cannot be hidden** even though the visibility toggle exists; they are required by the enrollment process (Email, Mobile Number for OTP). If you uncheck them and the learner tries to register, the form may submit but downstream enrollment can fail.

### 3.10 Create an Invite that uses custom fields

**Steps:**
1. Manage Students → **Create Invite**.
2. The dialog opens with Name / Email / Phone pre-populated.
3. Scroll to **Custom Fields** section. Any field whose visibility includes *Invite List* shows up automatically.
4. Click **+ Add Custom Field** to add an *invite-specific* field that does not exist in Settings.
5. Toggle required, reorder, delete (only the non-default ones).
6. Save the invite.

**What happens behind the scenes:**
- For fields already in Settings, the form just references them by id.
- For brand-new fields added in this dialog, the backend creates new master rows + new institute mappings of `type=ENROLL_INVITE`, `typeId=<inviteId>`.
- The default Name/Email/Phone are auto-cloned into `ENROLL_INVITE` mappings for this invite.

**Watch out:**
- **A field added here is per-invite, not institute-wide.** It will not appear in Settings → Custom Fields automatically. To see it in other forms, an admin has to go to Settings and tick the matching location.
- **If you delete an invite-specific field from this dialog, the master row remains.** Re-creating it later inside another invite will produce another orphan master row (or hit a key collision).
- **Fields edited here have numeric ids in the form state** but UUIDs in the backend; the conversion happens at submit time. If you save a half-completed dialog and re-open it, you may see fields renumbered. Cosmetic but confusing. See [Bug B-12](#b-12-numeric-vs-uuid-id-mismatch-in-invite-form).

### 3.11 Create an Audience / Campaign with custom fields

**Steps:**
1. Audience Manager → **Create Campaign**.
2. The form pulls fields visible at *Campaign* location from the cache **and** also calls a fresh lookup endpoint to merge in any fields added since the cache was warmed.
3. Edit / add / reorder / require — same UI affordances as Invite.
4. Save.

**Watch out:**
- The two data sources (cache + live lookup) can briefly **disagree** if a field was added in another tab. The fresher list wins, so the user may see a field that wasn't there a moment ago — looks like a flicker. See [Bug B-7](#b-7-stale-24h-cache-across-admin-sessions).
- **Filter-style audiences** (where custom fields are used as filter criteria, not data collection) only work for fields whose master row has `is_filter=true`. The admin has no UI to flip this — it's hard-coded based on how the field was created. See [Bug B-11](#b-11-is_filter--is_sortable-not-toggleable-in-the-ui).

### 3.12 Schedule a Live Class with guest custom fields

**Steps:**
1. Study Library → Live Sessions → **Schedule**.
2. Step 2 (the "Registration Form" step) has a **Custom Fields** section.
3. Fields visible at *Live Session Registration Form* in Settings are pre-populated.
4. Click **+ Add Custom Field** to add session-specific fields.
5. Save.

**Watch out:**
- The Live Session step uses an **internal schema with the option key `optionField`**, but the API expects `value`/`label`. There is a transform layer in between; if it ever drifts, dropdown options on session forms break silently. See [Bug B-14](#b-14-live-session-option-schema-mismatch).
- **Class-name typo:** `addCustomFiledSchema` (Filed vs Field) — it ships in production but is purely cosmetic.

### 3.13 Create an Assessment with registration custom fields

**Steps:**
1. Assessment → Create Assessment → **Step 3 (Add Participants)**.
2. For *Open Registration* assessments, you see the same pattern: defaults + custom fields visible at *Assessment Registration Form*.
3. Add / require / reorder.

**Watch out:**
- Assessment custom fields are stored in the **assessment service** (a different microservice) using its own table. The link back to the master `custom_fields` is by id only — there is no FK. If a field is deleted from Settings, the assessment may still reference its UUID.
- The Step 3 helper performs many transformations between admin UI shape, store shape, and API shape. Edge cases (an empty options array, a field with both old and new ids) sometimes throw "field undefined" runtime errors in the browser. See [Bug B-15](#b-15-step3-transform-fragility-on-edge-data).

### 3.14 View custom field answers in the Learner list / profile

**Steps:**
1. Manage Students → Learners.
2. The table columns are partially generated from custom fields visible at *Learner's List*. Only fields whose master row has `is_filter=true` and `is_sortable=true` get usable filters/sorts.
3. Click a learner → custom field answers appear in the profile drawer for fields visible at *Learner Profile*.

**Watch out:**
- **Deleted fields' answers are still in the DB** but won't show because the column generator ignores them. The row exists, the renderer doesn't.
- **If a learner has more than one answer for the same field across contexts** (e.g. one phone number from enroll invite, another from a live session registration), the table picks the most recent one. This can be confusing if the admin expected the "profile" answer.

### 3.15 System ↔ Custom Field mapping

**Steps:**
1. Settings → **System to Custom Field Mapping** sub-tab.
2. Pick an entity type (Student / User / Enquiry).
3. See the catalog of system fields (database columns) and tick which custom field each maps to.
4. Pick a sync direction: bidirectional, system→custom, custom→system, or none.
5. Save.

**What it does:** When the entity is updated, a sync job copies values across. Useful for legacy data: e.g. you can have a custom field "Phone" that automatically pulls from `User.mobile_number`.

**Watch out:**
- **Sync only runs when the API endpoints are explicitly called** (`/sync/system-to-custom`, `/sync/custom-to-system`). There is no event-driven sync — if you create a learner via direct DB or via an unrelated endpoint, the mapping does not auto-fire.
- **Converter classes are referenced by string class name** (`converterClass`). If the named class doesn't exist on the backend classpath, sync silently no-ops or throws.

---

## 4. Known Bugs & Issues

Bugs are tagged with severity, the file/line where the issue lives (cross-reference to [CUSTOM_FIELDS.md](CUSTOM_FIELDS.md) for full code context), and a recommended fix.

### 4.1 Critical

#### B-0. The Settings page shows duplicate fields and mis‑classified system fields

**Where:** Combination of [B-23](#b-23-custom_fieldsfield_key-has-no-sql-unique-constraint--duplicates-accumulate) (no DB unique constraint on `field_key`) + [B-24](#b-24-system-field-badge-is-decided-by-a-frontend-name-match-heuristic) (frontend name-match heuristic for "System Field" badge).

**Symptom (visible in production):** Settings → Custom Fields shows rows like `name`, `email`, `username`, `password`, `batch`, `phone`, **plus 2-3 duplicate `email` rows**, all labelled "System Field". Some are required, some aren't, some have visibility ticked, some don't — they look like garbage data because they are.

**Why it looks confusing:** Three things conspire:
1. The backend has **no SQL UNIQUE** on `custom_fields.field_key`, so duplicate inserts succeed (Bug B-23).
2. Old / migrated data left behind `custom_fields` rows with names exactly matching the frontend's hardcoded `SYSTEM_FIELD_NAMES` list (`name / email / username / password / batch / phone`), so they all get the "System Field" badge.
3. The current seeder only inserts `Full Name`, `Email`, `Phone Number` — but a previous version (or a migration) clearly inserted the other 4 names, and nobody cleaned up.

**What an admin should do today:**
1. Run the diagnostic SQL below to see exactly what's in the table.
2. Identify which rows are real (referenced by active mappings, have learner answers) and which are orphans.
3. Manually soft‑delete the orphans (`UPDATE institute_custom_fields SET status='DELETED' WHERE id IN (...)`) — but **do not** delete the master `custom_fields` rows because their `id` may be referenced by historical `custom_field_values`.
4. Refresh the admin dashboard cache by clearing `localStorage['custom-field-settings-cache']`.

**Diagnostic SQL:**

```sql
-- 1. List every "system-looking" custom field row for this institute
SELECT cf.id              AS custom_field_id,
       cf.field_key,
       cf.field_name,
       cf.field_type,
       cf.status          AS cf_status,
       cf.created_at      AS cf_created,
       icf.id             AS mapping_id,
       icf.type           AS mapping_type,
       icf.type_id        AS mapping_type_id,
       icf.status         AS mapping_status,
       icf.created_at     AS mapping_created
  FROM custom_fields cf
  JOIN institute_custom_fields icf ON icf.custom_field_id = cf.id
 WHERE icf.institute_id = '<INSTITUTE_ID>'
   AND lower(cf.field_name) IN ('name','email','username','password','batch','phone','full name','phone number')
 ORDER BY cf.field_name, cf.created_at;

-- 2. Count duplicates by field_name
SELECT lower(cf.field_name) AS name, COUNT(DISTINCT cf.id) AS dup_rows
  FROM custom_fields cf
  JOIN institute_custom_fields icf ON icf.custom_field_id = cf.id
 WHERE icf.institute_id = '<INSTITUTE_ID>'
 GROUP BY lower(cf.field_name)
HAVING COUNT(DISTINCT cf.id) > 1;

-- 3. Check whether any duplicate has actual learner answers
SELECT cf.id, cf.field_name, COUNT(cfv.id) AS answer_count
  FROM custom_fields cf
  LEFT JOIN custom_field_values cfv ON cfv.custom_field_id = cf.id
 WHERE cf.id IN (<list of duplicate ids from query 1>)
 GROUP BY cf.id, cf.field_name
 ORDER BY answer_count DESC;
```

The row with the highest `answer_count` is the "real" one — keep it. Soft‑delete the others by flipping their `institute_custom_fields.status` to `DELETED`.

**Permanent fix:** apply both [B-23](#b-23-custom_fieldsfield_key-has-no-sql-unique-constraint--duplicates-accumulate) and [B-24](#b-24-system-field-badge-is-decided-by-a-frontend-name-match-heuristic).

#### B-1. Cannot recreate a field after soft delete

**Where:** [InstituteCustomFiledService.findOrCreateCustomFieldWithLock](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/service/InstituteCustomFiledService.java) (lines 127-136) and [CustomFields.java](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/entity/CustomFields.java) (`@Column(unique=true)` on `field_key`).

**Symptom:** Admin deletes a custom field "University ID", later tries to add a new field with the same name, gets a 500 / unique-constraint violation.

**Root cause:** `findOrCreateCustomFieldWithLock` looks up by `(field_key, status='ACTIVE')`. When the previous field was soft-deleted, its row still occupies the unique `field_key` slot but has status `DELETED`, so the lookup misses it and the code tries to insert a duplicate.

**Recommended fix:** Either (a) reactivate the existing soft-deleted row when found, or (b) drop `unique=true` and rely on a partial unique index `WHERE status = 'ACTIVE'`.

#### B-2. Default fields have inconsistent required state

**Where:** [InstituteCustomFiledService.createDefaultCustomFieldsForInstitute](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/service/InstituteCustomFiledService.java#L246-L294).

**Symptom:** Name/Email/Phone are shown as required in the UI but the database master row has `is_mandatory=false`. Backend code paths that read `is_mandatory` directly will see them as optional.

**Root cause:** Two sources of truth: the master row's `is_mandatory` column **and** the JSON blob's `compulsoryCustomFields` array. The default seeder sets only the array.

**Recommended fix:** Pick one source of truth. The cleanest path is to set `is_mandatory=true` on the seeded rows and remove the parallel `compulsoryCustomFields` mechanism, OR explicitly mark `is_mandatory` as deprecated for default fields and audit every reader.

#### B-3. Partial failure during institute bootstrap

**Where:** [InstituteSettingService.createDefaultSettingsForInstitute](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/service/setting/InstituteSettingService.java#L119-L143).

**Symptom:** If `createDefaultCustomFieldSetting` throws after the relational rows have been inserted, the institute ends up with the three default field rows but no JSON blob in `institute.setting`. Settings → Custom Fields then renders an empty list.

**Root cause:** Each step is wrapped in try/catch and only logs; the @Transactional inside `createDefaultCustomFieldSetting` is on a self-invoked method, so Spring's proxy may not pick up the rollback boundary as expected.

**Recommended fix:** Pull `createDefaultCustomFieldSetting` into its own bean call (so the proxy is honoured), AND wrap the whole bootstrap in a single outer transaction so any failure rolls everything back.

### 4.2 High

#### B-4. EMAIL/PHONE renderer is inferred from the field name

**Where:** [custom-field-helpers.ts `getFieldRenderType`](../../Vacademy_Frontend/frontend-learner-dashboard-app/src/components/common/enroll-by-invite/-utils/custom-field-helpers.ts).

**Symptom:** A custom field named *"Postal mail address"* is rendered as an email input. *"Phone interview notes"* is rendered as an international phone input.

**Root cause:** The learner app keyword-matches the field key against `["mail","email","e-mail"]` and `["phone","mobile","contact","telephone","cell"]` to choose the renderer.

**Recommended fix:** Add an explicit `renderType` enum to the field definition (text / number / email / phone / dropdown) and stop inferring. Migrate existing fields with a one-shot job that sets `renderType` based on the current heuristic so behaviour doesn't regress.

#### B-5. Key stays frozen when name changes

**Where:** [InstituteCustomFiledService.updateCustomField](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/service/InstituteCustomFiledService.java#L432-L465).

**Symptom:** Renaming "Phone Number" to "Mobile Number" leaves the key as `phone_number_inst_<id>`. The PHONE renderer (Bug B-4) still applies because it inspects the key.

**Recommended fix:** Acceptable to keep the key stable (it's an identifier) — but the renderer should not depend on it. Fix B-4 first, then this becomes a non-issue.

#### B-6. Soft-delete leaves orphan answers

**Where:** [InstituteCustomFiledService.softDeleteInstituteCustomField](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/service/InstituteCustomFiledService.java#L159-L162) and the absence of any `custom_field_values` cleanup.

**Symptom:** Deleting a field hides it from the UI but the answers remain in `custom_field_values` indefinitely. Sensitive data (ID numbers, passport numbers) is not actually purged. GDPR / data-retention concerns.

**Recommended fix:** Provide a "Permanent Delete" admin action that hard-deletes both the master row, the mappings, and the answers. Default soft-delete remains.

#### B-7. Stale 24h cache across admin sessions

**Where:** [custom-field-settings.ts](../../Vacademy_Frontend/frontend-admin-dashboard/src/services/custom-field-settings.ts) — `localStorage` cache with 24-hour TTL.

**Symptom:** Admin A creates a new field. Admin B doesn't see it for up to 24 hours. Admin B might also accidentally overwrite Admin A's change because the save sends the **whole** settings document and B's blob is stale.

**Recommended fix:** Drop TTL to ~5 minutes, add a "Refresh" button next to the Save button, and add an `If-Match` / `version` field to the save call so the backend can reject stale writes.

#### B-8. No optimistic concurrency on save

**Where:** [InstituteCustomFieldSettingController.updateCustomFieldSetting](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/controller/InstituteCustomFieldSettingController.java).

**Symptom:** Two admins editing simultaneously: whoever clicks Save second silently overwrites the first one's changes (no error, no merge).

**Recommended fix:** Add an `updated_at` or `version` field to the institute setting JSON, return it in the GET, require it in the POST, and 409 if it doesn't match.

### 4.3 Medium

#### B-9. Key generator strips unicode causing silent collisions

**Where:** [CustomFieldKeyGenerator.generateFieldKey](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/util/CustomFieldKeyGenerator.java).

**Symptom:** *"Phone 📱"* and *"Phone"* generate identical keys. *"प्रवेश संख्या"* (Hindi for "enrollment number") generates `field_inst_<id>` because every character is stripped.

**Recommended fix:** Use the field's UUID as the storage key and only use the human name for display. Or fall back to a short hash of the original name.

#### B-10. Required flag cannot vary per location

**Where:** Top-level `compulsoryCustomFields` in [CustomFieldSettingRequest](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/dto/settings/custom_field/CustomFieldSettingRequest.java).

**Symptom:** Admin wants "Phone" to be required during enroll invite but optional in the learner profile. The model doesn't allow it.

**Recommended fix:** Move `required` from a top-level array of field IDs to a property on each location's field reference. Migration: every existing required field becomes required in every location it's currently visible.

#### B-11. `is_filter` & `is_sortable` not toggleable in the UI

**Where:** Master row defaults in [InstituteCustomFiledService.createCustomFieldFromRequest](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/service/InstituteCustomFiledService.java#L300-L318) — `is_filter` and `is_sortable` are not set from the UI form, so they default to false.

**Symptom:** New custom fields don't appear as filterable columns in the learner table even though the admin ticked "Learner's List" visibility.

**Recommended fix:** Add two checkboxes ("Filterable", "Sortable") to the Add/Edit Custom Field dialog and pipe them to the API.

#### B-12. Numeric vs UUID id mismatch in invite form

**Where:** [InviteFormSchema.tsx](../../Vacademy_Frontend/frontend-admin-dashboard/src/routes/manage-students/invite/-schema/InviteFormSchema.tsx) — `id: z.number()` for invite custom fields, but the backend uses UUID strings stored in `_id`.

**Symptom:** Renumbering of fields in the dialog after a save can confuse the user; some logs print the numeric id instead of the UUID; conversion edge cases (drag-drop after delete) sometimes assign duplicate numeric ids.

**Recommended fix:** Use the UUID directly. Drop `id: number`. The drag-drop library accepts strings.

#### B-13. Groups are not visually rendered in all flows

**Where:** Invite form & Audience form rendering — the field list is flat. Only the Settings page and the Live Class step honor groups visually.

**Symptom:** Admin groups fields as "Personal Info" / "Education History"; learner sees one big flat list.

**Recommended fix:** Render group headers in the Invite and Audience forms.

#### B-14. Live session option schema mismatch

**Where:** [scheduleStep2.tsx schema](../../Vacademy_Frontend/frontend-admin-dashboard/src/routes/study-library/live-session/schedule/-schema/schema.ts) — uses `{ optionField: string }` for dropdown options instead of the canonical `{ id, value, label }`. A transform layer maps between them at submit time.

**Symptom:** If the transform breaks (refactor, missed case), session form dropdowns become empty silently.

**Recommended fix:** Standardise on the canonical option shape across all flows.

#### B-15. Step 3 transform fragility on edge data

**Where:** [Step3 helper.ts](../../Vacademy_Frontend/frontend-admin-dashboard/src/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/helper.ts) — `transformAllBatchData` and `getCustomFieldsWhileEditStep3` perform several layers of conversion.

**Symptom:** Re-opening an existing assessment with custom fields that have empty option arrays or missing `_id` sometimes throws "Cannot read properties of undefined".

**Recommended fix:** Add defensive defaults at every conversion step and a unit test per shape.

#### B-16. Public open endpoints leak field configuration

**Where:** `/admin-core-service/open/common/custom-fields/setup?instituteId=…` and friends.

**Symptom:** An attacker who guesses an `instituteId` can enumerate the entire custom field catalogue of any institute, including option lists. While not personally identifying, it's information disclosure.

**Recommended fix:** Require a per-institute slug + a CSRF-style nonce, or rate-limit by IP.

### 4.4 Low / Cosmetic

#### B-17. Class name typo: `InstituteCustomFiledService`

**Where:** [InstituteCustomFiledService.java](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/service/InstituteCustomFiledService.java) — class name has *Filed* instead of *Field*.

**Impact:** Code-search confusion. No runtime effect.

**Recommended fix:** Rename the class and all imports in one PR.

#### B-18. Endpoint URL typo: `insititute-settings`

**Where:** [src/constants/urls.ts](../../Vacademy_Frontend/frontend-admin-dashboard/src/constants/urls.ts) — `/admin-core-service/institute/v1/insititute-settings`.

**Impact:** Backend route is also misspelled, so they match. Confusing for new engineers.

**Recommended fix:** Add a correctly-spelled route alias on the backend, switch the frontend, then deprecate the typo route after a release.

#### B-19. `isPresent` query param is a String, not boolean

**Where:** [InstituteCustomFieldSettingController.updateCustomFieldSetting](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/controller/InstituteCustomFieldSettingController.java) — `@RequestParam(value="isPresent", required=false) String isPresent`.

**Impact:** Encourages clients to pass `"true"` / `"false"` / `"1"` / `null` inconsistently. Harder to test.

**Recommended fix:** Change to `Boolean isPresent`.

#### B-20. Two parallel custom-field tables (legacy `learner_invitation_custom_field`)

**Where:** [V1__Initial_schema.sql L1274](../admin_core_service/src/main/resources/db/migration/V1__Initial_schema.sql#L1274).

**Impact:** New devs assume the legacy table is current and add features to the wrong system. Confusing data model.

**Recommended fix:** Document deprecation, audit usages, plan a migration to the unified system, then drop the legacy tables.

#### B-21. `findCustomFieldUsageAggregation` does not filter master-row status

**Where:** [InstituteCustomFieldRepository.findCustomFieldUsageAggregation](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/repository/InstituteCustomFieldRepository.java).

**Impact:** Fields whose master row has been individually marked deleted may still appear in usage reports if they have any active mappings.

**Recommended fix:** Add `AND cf.status = 'ACTIVE'` to the JPQL query.

#### B-23. `custom_fields.field_key` has no SQL UNIQUE constraint — duplicates accumulate

**Where:** [V1__Initial_schema.sql:163-179](../admin_core_service/src/main/resources/db/migration/V1__Initial_schema.sql#L163-L179) defines no UNIQUE on `field_key`. The entity has `@Column(unique=true)` but Hibernate only enforces that when it's the schema generator, not when Flyway is.

**Symptom:** Multiple `custom_fields` rows can have `field_name = 'email'` and identical (or near-identical) `field_key`. The Settings → Custom Fields page renders all of them — see the screenshot with three side‑by‑side `email` rows. `findOrCreateCustomFieldWithLock` thinks it's safe to insert because it only checks ACTIVE status by key, but even if it found an existing row, the lookup races against the missing DB constraint.

**Root cause:** A schema/code mismatch — the entity declares uniqueness, the SQL doesn't enforce it.

**Recommended fix:** Add a Flyway migration:
```sql
-- First clean up any existing duplicates by keeping the oldest ACTIVE row
-- per (field_key) and reassigning institute_custom_fields rows to it.
-- Then:
CREATE UNIQUE INDEX uq_custom_fields_field_key
    ON public.custom_fields (field_key)
    WHERE status = 'ACTIVE';
```
This makes `findOrCreateCustomFieldWithLock` actually safe under contention. Combine with the fix for [B-1](#b-1-cannot-recreate-a-field-after-soft-delete) so soft-deleted rows can be reactivated instead of triggering a constraint violation.

#### B-24. "System Field" badge is decided by a frontend name-match heuristic

**Where:** [src/services/custom-field-settings.ts](../../Vacademy_Frontend/frontend-admin-dashboard/src/services/custom-field-settings.ts) line 259 (`SYSTEM_FIELD_NAMES`) and lines 596-610 (`mapApiResponseToUI`).

```ts
const SYSTEM_FIELD_NAMES = ['name', 'email', 'username', 'password', 'batch', 'phone'];

if (SYSTEM_FIELD_NAMES.includes(apiField.fieldName.toLowerCase()) || …) {
    fixedFields.push(...);   // gets the "System Field" badge, locked editing
}
```

**Symptom (multiple variants):**
1. **Default fields lose their lock.** The seeder writes `Full Name` and `Phone Number`. Neither matches the lowercase keys in `SYSTEM_FIELD_NAMES` exactly, so on next page load they fall into the editable `customFields` bucket — admins can rename, retype, even delete them, contradicting the `canBeDeleted=false` flag the backend stamped on them.
2. **Renaming a user-created field to "email" or "batch" silently locks it.** A normal custom field becomes uneditable on next reload because its name now matches the heuristic.
3. **Legacy data masquerades as system fields.** Institutes with old `custom_fields` rows literally named `name / username / password / batch` will see them all badged as "System Field", even though no backend flag actually classifies them that way.

**Root cause:** Classification should be a backend property of the field row (e.g. a `is_system` boolean or a `kind` enum on `custom_fields`), not a string match in the renderer.

**Recommended fix:**
1. Add a `kind` column to `custom_fields` with values `SYSTEM` (locked seeded field), `INSTITUTE` (institute-wide custom), `CONTEXT` (per-invite/per-session). Backfill from current data: anything created by `createDefaultCustomFieldsForInstitute` becomes `SYSTEM`.
2. Replace the `SYSTEM_FIELD_NAMES` heuristic with a check on the new column.
3. Stop relying on `canBeDeleted` / `canBeEdited` / `canBeRenamed` flags travelling through the JSON blob — derive them from `kind` server-side.

#### B-22. `hasPrefillAppliedRef` blocks repeat prefill

**Where:** [enroll-form.tsx](../../Vacademy_Frontend/frontend-learner-dashboard-app/src/components/common/enroll-by-invite/enroll-form.tsx) — a `useRef` guards prefill from running twice.

**Impact:** If the learner navigates back and forth on the enrollment form, the prefill from `localStorage` is not re-applied because the ref stays true across re-renders inside the same component instance.

**Recommended fix:** Reset the ref when route params change, or run prefill via `useEffect([routeKey])`.

---

## 5. UX Gotchas (not bugs, but surprising)

| # | Gotcha | Why it surprises users |
|---|--------|-----------------------|
| G-1 | Saving in Settings sends the **entire** field catalogue, not just the diff. | Editing one field touches every other field's row at save time. Audit logs look noisy. |
| G-2 | The 9 visibility checkboxes are independent — there is no "show in all" shortcut. | Onboarding 20 fields means 180 clicks. |
| G-3 | "Custom Fields" and "Fixed Fields" are visually similar but behave differently. | Admins try to delete Name/Email/Phone and don't understand why the trash icon is missing. |
| G-4 | The Invite dialog shows custom fields that came from Settings **and** lets you add invite-only fields, but doesn't visually distinguish them. | Admins think they're editing the global field when they're actually creating an invite-scoped one. |
| G-5 | Required fields show an asterisk; hidden fields show no indicator. | Hard to tell at a glance which form a field will appear in — you have to open Settings. |
| G-6 | Renaming a system field (e.g. "Gender" → "Sex") changes the label everywhere immediately, but exports and reports may still show the old name. | Admin assumes a global rename succeeded. |
| G-7 | Drag-and-drop reorder updates `individual_order` for all moved fields. The order field is hidden in the UI. | "I dragged once but ten fields got 'modified at' updates" — looks scary in audit logs. |
| G-8 | The "Custom Fields with usage" panel counts mappings, not unique learners with answers. | A field with 1 active invite shows usage=1 even if 10,000 learners have answered it. |

---

## 6. Recommended Improvements

In rough priority order, these would dramatically improve the custom-field experience:

1. **Unify the source of truth.** Pick *either* the master row flags (`is_mandatory`, `is_filter`, `is_sortable`) *or* the JSON blob — not both. (Fixes B-2, removes a whole class of drift bugs.)
2. **Hard-delete option with answer purge.** Required for GDPR. (Fixes B-6.)
3. **Optimistic concurrency control on settings save.** (Fixes B-7, B-8.)
4. **Explicit `renderType` field on every custom field.** Drop the keyword inference. (Fixes B-4, B-5.)
5. **Reactivation-safe soft delete.** When creating a field, look for soft-deleted rows with the same key and reactivate. (Fixes B-1.)
6. **Drop the 24-hour cache TTL** to ~5 minutes and add a manual refresh control. (Fixes B-7.)
7. **Surface `is_filter` / `is_sortable` toggles** in the Add/Edit dialog. (Fixes B-11.)
8. **Per-location required flag.** (Fixes B-10, requires schema change.)
9. **Standardise dropdown option shape** across Settings, Invite, Audience, Live Session, Assessment, and Learner. (Fixes B-14.)
10. **Render groups in Invite + Audience forms.** (Fixes B-13.)

---

## 7. Test Checklist for QA

Use this when validating any change in the custom-field area:

### Settings page
- [ ] Open Settings → Custom Fields. Cache empty: data loads from API. Cache present: data loads instantly.
- [ ] Add a text field; tick all 9 locations; save; reload; field persists.
- [ ] Add a dropdown field with 5 options; save; verify options round-trip on reload.
- [ ] Add a number field; save; verify type is preserved.
- [ ] Edit a field's name; save; reload; verify renamed; verify the underlying key did **not** change (DB inspection or backend log).
- [ ] Mark a field required; reload; required state persists.
- [ ] Reorder fields by drag-drop; save; reload; new order persists.
- [ ] Delete a custom field; save; reload; field gone from UI.
- [ ] **Try to recreate a field with the same name as a deleted one** → currently fails (Bug B-1).
- [ ] Two browser tabs, both edit different fields, save in sequence → second save silently overwrites first (Bug B-8).
- [ ] Rename a system field (e.g. Gender → Sex); reload; rename persists; check that exports still use old name.

### Default fields
- [ ] Brand-new institute: Name/Email/Phone exist in Settings, marked required, locked.
- [ ] Master row inspection: confirm `is_mandatory` is `false` despite the UI marking required (Bug B-2).
- [ ] Create an invite immediately after institute setup: Name/Email/Phone are auto-populated as required.

### Invite flow
- [ ] Open Create Invite. Custom fields visible at "Invite List" appear automatically.
- [ ] Add an invite-only custom field; save invite; open invite link as learner; field appears.
- [ ] Edit an existing invite; the previously added custom field is still there.
- [ ] Delete the invite-only field from the dialog; save; recreate it with the same name; verify whether duplicates appear (Bug B-1 variant).

### Audience / Campaign
- [ ] Custom fields with "Campaign" visibility appear in the create-campaign form.
- [ ] Add custom field after another tab opened the form; new field appears after the live lookup overrides the cache.

### Live Class
- [ ] Custom fields with "Live Session Registration Form" visibility appear in Step 2.
- [ ] Add a session-specific custom field with dropdown options; save the schedule; open the public registration page as guest; options render correctly.

### Assessment
- [ ] Custom fields with "Assessment Registration Form" visibility appear in Step 3.
- [ ] Add a dropdown field; save; open the public assessment registration page; dropdown renders.
- [ ] Re-open an existing assessment that has custom fields with empty option arrays — should not crash (Bug B-15).

### Learner side
- [ ] A custom field named "Postal mail address" → check renderer; expected text, currently email (Bug B-4).
- [ ] A custom field named "Phone interview notes" → check renderer; expected text, currently phone (Bug B-4).
- [ ] Submit a value for a soft-deleted field (via direct API call) → should fail; field's status is DELETED.
- [ ] Submit dropdown value not in the option list (via API) → backend should reject; currently accepts any string.

### Permissions / security
- [ ] Public endpoint `GET /admin-core-service/open/common/custom-fields/setup?instituteId=…` returns full field config without auth (Bug B-16).
- [ ] Deleted field's `custom_field_values` rows are still queryable (Bug B-6).

---

## See Also

- [CUSTOM_FIELDS.md](CUSTOM_FIELDS.md) — full technical reference (schema, services, controllers, frontend code paths)
- [`vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/) — backend service code
- [`Vacademy_Frontend/frontend-admin-dashboard/src/components/settings/CustomFieldsSettings.tsx`](../../Vacademy_Frontend/frontend-admin-dashboard/src/components/settings/CustomFieldsSettings.tsx) — Settings UI component
