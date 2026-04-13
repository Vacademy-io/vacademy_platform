# Custom Fields — Production Cleanup Runbook

> Companion to [CUSTOM_FIELDS.md](CUSTOM_FIELDS.md) and [CUSTOM_FIELDS_ADMIN_FLOWS_AND_ISSUES.md](CUSTOM_FIELDS_ADMIN_FLOWS_AND_ISSUES.md).
>
> Audience: a backend engineer with prod DB access.
>
> Goal: clean up the bad data left behind by the pre‑revamp custom-field code paths in the few production institutes that have been using custom fields, **without** running a blanket migration script. Each institute is handled individually so we can verify before and after.
>
> **This runbook does not modify schemas or run on every institute.** It is a per‑institute, manually‑verified cleanup. The application code is now reactivation‑safe and will not regenerate the same garbage going forward (see the custom fields revamp in [CUSTOM_FIELDS.md](CUSTOM_FIELDS.md)). What we are cleaning here is historical data only.

---

## Table of Contents

1. [What we are cleaning, and why](#1-what-we-are-cleaning-and-why)
2. [Symptoms in the UI](#2-symptoms-in-the-ui)
3. [Pre-flight checklist](#3-pre-flight-checklist)
4. [Step 1 — Identify affected institutes](#4-step-1--identify-affected-institutes)
5. [Step 2 — Inventory the damage for one institute](#5-step-2--inventory-the-damage-for-one-institute)
6. [Step 3 — Decide the canonical row for each duplicate field](#6-step-3--decide-the-canonical-row-for-each-duplicate-field)
7. [Step 4 — Soft-delete duplicate `institute_custom_fields` mappings](#7-step-4--soft-delete-duplicate-institute_custom_fields-mappings)
8. [Step 5 — Re-point answers in `custom_field_values` to the canonical row](#8-step-5--re-point-answers-in-custom_field_values-to-the-canonical-row)
9. [Step 6 — Mark orphan master `custom_fields` rows as DELETED](#9-step-6--mark-orphan-master-custom_fields-rows-as-deleted)
10. [Step 7 — Refresh the institute's `CUSTOM_FIELD_SETTING` JSON blob](#10-step-7--refresh-the-institutes-custom_field_setting-json-blob)
11. [Step 8 — Verification](#11-step-8--verification)
12. [Step 9 — Have the admin clear localStorage](#12-step-9--have-the-admin-clear-localstorage)
13. [Rollback procedure](#13-rollback-procedure)
14. [Optional follow-ups](#14-optional-follow-ups)

---

## 1. What we are cleaning, and why

Three classes of bad data have accumulated:

| # | What | Source | How we fix it |
|---|------|--------|---------------|
| **A** | **Duplicate `custom_fields` master rows** with the same `field_name` (e.g. three rows all named `email`). | The `custom_fields.field_key` column is declared `@Column(unique=true)` at the entity level but no `UNIQUE` constraint exists in SQL ([V1__Initial_schema.sql:163-179](../admin_core_service/src/main/resources/db/migration/V1__Initial_schema.sql#L163-L179)). Pre-revamp code that bypassed `findOrCreateCustomFieldWithLock` (e.g. legacy seeders, migration scripts, the now-deleted `Step2Service.saveNewCustomField` path that wrote `instituteId=""`) inserted duplicates. | Pick one canonical row per `(institute_id, lower(field_name))`, repoint references, soft-delete the rest. |
| **B** | **Inflated `institute_custom_fields` mappings** — e.g. 504 ACTIVE rows pointing at the same `(institute, custom_field, type, type_id)`. All inserted in the same millisecond. | Pre-revamp `addOrUpdateCustomField` was reactivation-aware but its callers (`copyDefaultCustomFieldsToEnrollInvite`, audience save) ran in loops that bypassed the check, or a backfill script bulk-inserted without dedup. | Keep the **oldest ACTIVE** mapping per `(institute, custom_field, type, COALESCE(type_id,''))`, soft-delete the rest. |
| **C** | **Mis-classified "system fields"** in the admin UI — fields named `name / username / password / batch / phone` (lowercase) that show with the "System Field" badge because of the old frontend heuristic at `SYSTEM_FIELD_NAMES`. | Pre-revamp seeder code inserted these (or migrations did). The current seeder only writes `Full Name / Email / Phone Number`. | After A and B are clean, remove or rename these rows. The new revamp UI shows them as DEFAULT — admins can choose to keep, rename or delete from Settings → Custom Fields. |

> **Note:** the application code that produced this damage has been replaced — see the custom-fields-revamp section of [CUSTOM_FIELDS.md](CUSTOM_FIELDS.md). Running this cleanup once per affected institute is enough; future writes go through the unified `syncFeatureCustomFields` path which is reactivation-safe.

## 2. Symptoms in the UI

You will hit this runbook for an institute if **any** of these are visible:

- Settings → Custom Fields shows **2+ rows with identical names** (most commonly `email`, sometimes `phone` / `name`).
- Admin reports the same custom field "comes back" after they delete it from a feature dialog.
- Backend logs show 200+ `institute_custom_fields` rows for one feature instance.
- Querying `institute_custom_fields WHERE institute_id = ? AND status = 'ACTIVE'` returns hundreds of rows where you'd expect ~10.

## 3. Pre-flight checklist

Before you touch anything in production:

- [ ] You have a **read replica** or a **fresh `pg_dump`** of `admin_core_service` from within the last 24 h. Cleanup is destructive (soft-deletes are recoverable, but value-repointing is not without the dump).
- [ ] You have the **institute id** of the affected institute (not the slug, not the name).
- [ ] You can talk to the institute admin to coordinate. Don't run this during their peak enrollment window.
- [ ] You have a SQL client that supports **explicit transactions** (`BEGIN; … ROLLBACK;`) — `psql` is best.
- [ ] You have the `flyway_schema_history` available so you can correlate damage timestamps with deploys.
- [ ] You have read [CUSTOM_FIELDS.md](CUSTOM_FIELDS.md) §1–4 (the data model) and [CUSTOM_FIELDS_ADMIN_FLOWS_AND_ISSUES.md](CUSTOM_FIELDS_ADMIN_FLOWS_AND_ISSUES.md#41-critical) §B-0/B-1/B-23/B-24 (the bug context).

> **All SQL below uses `:institute_id` as a placeholder.** Replace it with the actual UUID and `\set institute_id 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'` in psql, or substitute manually.

---

## 4. Step 1 — Identify affected institutes

Run this query against production. It returns one row per institute that has either a duplicate-master-row problem (A) or a mapping-inflation problem (B).

```sql
WITH dup_masters AS (
    SELECT icf.institute_id,
           lower(cf.field_name) AS field_name,
           COUNT(DISTINCT cf.id) AS dup_master_rows
      FROM custom_fields cf
      JOIN institute_custom_fields icf ON icf.custom_field_id = cf.id
     GROUP BY icf.institute_id, lower(cf.field_name)
    HAVING COUNT(DISTINCT cf.id) > 1
),
inflated_mappings AS (
    SELECT institute_id,
           custom_field_id,
           type,
           COALESCE(type_id, '') AS type_id_norm,
           COUNT(*) AS active_mappings
      FROM institute_custom_fields
     WHERE status = 'ACTIVE'
     GROUP BY institute_id, custom_field_id, type, COALESCE(type_id, '')
    HAVING COUNT(*) > 1
)
SELECT i.id   AS institute_id,
       i.institute_name,
       (SELECT COUNT(*) FROM dup_masters d
         WHERE d.institute_id = i.id) AS duplicate_field_names,
       (SELECT COALESCE(SUM(active_mappings - 1), 0)
          FROM inflated_mappings m
         WHERE m.institute_id = i.id) AS extra_mapping_rows
  FROM institutes i
 WHERE EXISTS (SELECT 1 FROM dup_masters d        WHERE d.institute_id = i.id)
    OR EXISTS (SELECT 1 FROM inflated_mappings m  WHERE m.institute_id = i.id)
 ORDER BY extra_mapping_rows DESC, duplicate_field_names DESC;
```

The result tells you (a) which institutes to clean and (b) roughly how much damage there is per institute. Pick **one** institute to start with and keep its ID handy.

---

## 5. Step 2 — Inventory the damage for one institute

For the chosen institute, run all four queries below. **Keep the output** — you will need it during the canonical-row decision in Step 3 and again at verification time in Step 8.

```sql
-- 5.1 Master rows the institute is currently linked to (any status)
SELECT cf.id           AS custom_field_id,
       cf.field_key,
       cf.field_name,
       cf.field_type,
       cf.status       AS cf_status,
       cf.created_at   AS cf_created,
       COUNT(icf.id)   AS mapping_count
  FROM custom_fields cf
  JOIN institute_custom_fields icf ON icf.custom_field_id = cf.id
 WHERE icf.institute_id = :institute_id
 GROUP BY cf.id, cf.field_key, cf.field_name, cf.field_type, cf.status, cf.created_at
 ORDER BY lower(cf.field_name), cf.created_at;

-- 5.2 Mapping inflation per (custom_field, type, type_id) — the headline bug
SELECT custom_field_id,
       type,
       type_id,
       status,
       COUNT(*) AS rows_per_tuple,
       MIN(created_at) AS first_created,
       MAX(created_at) AS last_created
  FROM institute_custom_fields
 WHERE institute_id = :institute_id
 GROUP BY custom_field_id, type, type_id, status
HAVING COUNT(*) > 1
 ORDER BY rows_per_tuple DESC;

-- 5.3 Answer counts per master row (so you know which dup is the "real" one)
SELECT cf.id, cf.field_name, cf.field_key, cf.created_at,
       (SELECT COUNT(*) FROM custom_field_values cfv
         WHERE cfv.custom_field_id = cf.id) AS answer_count
  FROM custom_fields cf
 WHERE cf.id IN (
        SELECT DISTINCT custom_field_id
          FROM institute_custom_fields
         WHERE institute_id = :institute_id
 )
 ORDER BY lower(cf.field_name), cf.created_at;

-- 5.4 Cross-check with the deployment timeline — if every duplicate row in 5.2
--     shares one millisecond, look for a Flyway migration or batch script that
--     ran at that time.
SELECT version, description, installed_on
  FROM flyway_schema_history
 WHERE installed_on BETWEEN '2025-11-01' AND '2025-11-30'
 ORDER BY installed_on;
```

> Save the output of 5.1 and 5.3 — you need them in Step 3.

---

## 6. Step 3 — Decide the canonical row for each duplicate field

For each group of duplicate masters (rows from 5.1 sharing a `lower(field_name)`), pick **one** to keep. Use this priority order:

1. **The row with the most `custom_field_values` answers** (from 5.3).
2. If tied: the **oldest `created_at`** (it's what new code paths will tend to find first via `ORDER BY created_at` in `findOrCreateCustomFieldWithLock`).
3. If still tied: the row whose `field_key` matches the current generator format `<name>_inst_<institute_id>` from [`CustomFieldKeyGenerator`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/util/CustomFieldKeyGenerator.java) — keep that one.
4. Otherwise: pick the lowest UUID and write down why.

Document your decisions in a temporary text file. You'll need this list for Steps 4–6. Format suggestion:

```
INSTITUTE: 91a5ad98-e7d8-41cd-adf5-6f7f7855646a
  email:
    KEEP   = 026e8a41-3b…  (504 answers, created 2024-08-12)
    REPLACE -> 8c91ff21-…  (3 answers)
    REPLACE -> a17b002e-…  (0 answers)
  phone:
    KEEP   = 4400df03-…    (980 answers, created 2024-08-12)
    REPLACE -> 026e8a41-3b…(0 answers, created 2025-11-17 06:29)
```

---

## 7. Step 4 — Soft-delete duplicate `institute_custom_fields` mappings

This is the safest cleanup step and the one that will visibly fix the UI. It does not delete master rows or answers — it only flips status on the duplicate junction rows.

```sql
-- DRY RUN — list what will change. Run this first and review the count.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY institute_id, custom_field_id, type, COALESCE(type_id, '')
               ORDER BY created_at ASC, id ASC
           ) AS rn
      FROM institute_custom_fields
     WHERE institute_id = :institute_id
       AND status = 'ACTIVE'
)
SELECT COUNT(*) AS rows_to_soft_delete
  FROM ranked WHERE rn > 1;

-- Optional: list a few examples so you know what you'll be touching.
WITH ranked AS (
    SELECT icf.*,
           ROW_NUMBER() OVER (
               PARTITION BY institute_id, custom_field_id, type, COALESCE(type_id, '')
               ORDER BY created_at ASC, id ASC
           ) AS rn
      FROM institute_custom_fields icf
     WHERE institute_id = :institute_id
       AND status = 'ACTIVE'
)
SELECT id, custom_field_id, type, type_id, created_at
  FROM ranked WHERE rn > 1
 ORDER BY custom_field_id, created_at
 LIMIT 50;

-- COMMIT — now do the soft-delete inside an explicit transaction.
BEGIN;
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY institute_id, custom_field_id, type, COALESCE(type_id, '')
               ORDER BY created_at ASC, id ASC
           ) AS rn
      FROM institute_custom_fields
     WHERE institute_id = :institute_id
       AND status = 'ACTIVE'
)
UPDATE institute_custom_fields
   SET status = 'DELETED',
       updated_at = now()
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Sanity-check the resulting active counts
SELECT type, COUNT(*) AS active_rows
  FROM institute_custom_fields
 WHERE institute_id = :institute_id
   AND status = 'ACTIVE'
 GROUP BY type
 ORDER BY type;

-- If looks right (counts dropped to a sane number, e.g. < 50 per type):
COMMIT;
-- Otherwise:
-- ROLLBACK;
```

---

## 8. Step 5 — Re-point answers in `custom_field_values` to the canonical row

For each "REPLACE → KEEP" pair from your decision list in Step 3, repoint any existing answers from the duplicate to the canonical master row. This is the only **non-reversible** step (without the dump from Pre-flight). Read the SQL carefully.

```sql
-- For ONE duplicate pair at a time. Repeat per duplicate.
-- Replace :duplicate_cf_id and :canonical_cf_id with actual UUIDs.

-- DRY RUN — how many answers will move?
SELECT COUNT(*)
  FROM custom_field_values
 WHERE custom_field_id = :duplicate_cf_id;

BEGIN;
UPDATE custom_field_values
   SET custom_field_id = :canonical_cf_id,
       updated_at      = now()
 WHERE custom_field_id = :duplicate_cf_id;

-- Confirm: should be 0
SELECT COUNT(*) FROM custom_field_values WHERE custom_field_id = :duplicate_cf_id;

COMMIT;
-- Or: ROLLBACK;
```

> If a learner had answers under **both** the duplicate and the canonical row (rare but possible), the simple `UPDATE` will fail on the unique key on `(custom_field_id, source_type, source_id, type, type_id)` if such a constraint exists, or silently produce two rows otherwise. **Check the schema** — at the time of writing there is no unique index there, so duplicates are tolerated. After the move, you can dedup by:
>
> ```sql
> -- For each (custom_field_id, source_type, source_id, type, type_id) keep newest only
> WITH ranked AS (
>     SELECT id,
>            ROW_NUMBER() OVER (
>                PARTITION BY custom_field_id, source_type, source_id, type, COALESCE(type_id,'')
>                ORDER BY updated_at DESC, id DESC
>            ) AS rn
>       FROM custom_field_values
>      WHERE custom_field_id = :canonical_cf_id
> )
> DELETE FROM custom_field_values
>  WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
> ```

---

## 9. Step 6 — Mark orphan master `custom_fields` rows as DELETED

After Steps 4 and 5, the duplicate master rows have **no active mappings** and **no remaining answers**. Soft-delete them by flipping `status` so the application stops considering them on future writes.

```sql
-- DRY RUN — list orphans for this institute
SELECT cf.id, cf.field_name, cf.field_key, cf.status
  FROM custom_fields cf
 WHERE cf.id IN (
        -- Master rows linked to this institute by any mapping…
        SELECT DISTINCT custom_field_id
          FROM institute_custom_fields
         WHERE institute_id = :institute_id
 )
 -- …that have NO active mapping anywhere…
   AND NOT EXISTS (
        SELECT 1 FROM institute_custom_fields icf
         WHERE icf.custom_field_id = cf.id
           AND icf.status = 'ACTIVE'
 )
 -- …and NO remaining answers.
   AND NOT EXISTS (
        SELECT 1 FROM custom_field_values cfv
         WHERE cfv.custom_field_id = cf.id
 )
   AND cf.status = 'ACTIVE';

-- COMMIT
BEGIN;
UPDATE custom_fields
   SET status = 'DELETED',
       updated_at = now()
 WHERE id IN (
        SELECT cf.id
          FROM custom_fields cf
         WHERE cf.id IN (
                SELECT DISTINCT custom_field_id
                  FROM institute_custom_fields
                 WHERE institute_id = :institute_id
         )
           AND NOT EXISTS (
                SELECT 1 FROM institute_custom_fields icf
                 WHERE icf.custom_field_id = cf.id
                   AND icf.status = 'ACTIVE'
         )
           AND NOT EXISTS (
                SELECT 1 FROM custom_field_values cfv
                 WHERE cfv.custom_field_id = cf.id
         )
           AND cf.status = 'ACTIVE'
 );
COMMIT;
```

> **Do not `DELETE FROM custom_fields`** — the table has FK references from `custom_field_values` ON DELETE CASCADE; a hard delete will silently destroy any answers you missed during repointing.

---

## 10. Step 7 — Refresh the institute's `CUSTOM_FIELD_SETTING` JSON blob

After the relational tables are clean, the institute's `institutes.setting` JSON blob still references the now-deleted master/mapping ids in `customFieldsAndGroups[].customFieldId`. The application reads from this blob on every Settings → Custom Fields page load, so it must be regenerated.

The cleanest way: use the application itself.

1. Have the institute admin (or you, with super-admin access) open Settings → Custom Fields **once**.
2. Click **Save Changes** without making any change.
3. The frontend `mapUIToApiRequest` will rebuild the blob from the now-clean relational state and POST it to `/admin-core-service/institute/v1/custom-field/create-or-update`.

If you cannot get an admin to do this, you can do it from a sql client by setting `setting = NULL` for that institute and calling `createDefaultCustomFieldSetting` again from a Spring shell — but the manual save is much safer.

---

## 11. Step 8 — Verification

Run the inventory queries from Step 5 again. You should now see:

- **5.1**: every `field_name` appears exactly once per institute. `mapping_count` is small and reasonable (typically `1` for `DEFAULT_CUSTOM_FIELD` rows, plus one per active feature instance).
- **5.2**: returns **zero rows**.
- **5.3**: every kept row's answer count matches the sum of the answer counts before cleanup. (Pre-cleanup snapshot of 5.3 plus your decision list = post-cleanup expected counts.)
- Settings → Custom Fields in the admin UI shows the right rows (3 defaults + whatever the admin had created).
- A test "create new Enroll Invite" flow shows the same set of fields pre-selected.

If anything looks wrong: `psql` history → `ROLLBACK` if you're still in a transaction, or restore from the dump in Pre-flight.

---

## 12. Step 9 — Have the admin clear localStorage

The admin dashboard caches the settings document in `localStorage['custom-field-settings-cache']` for 24 h. Until that expires, the admin will keep seeing the pre-cleanup rows.

Send the admin this snippet to paste into their browser DevTools console while logged in:

```js
localStorage.removeItem('custom-field-settings-cache');
location.reload();
```

(Or wait 24 h.)

---

## 13. Rollback procedure

Each numbered step is independently reversible **except Step 5**, which moves rows in `custom_field_values`. If you need to undo the entire cleanup for one institute:

| Step | Reversal |
|------|----------|
| 4 (mapping soft-delete) | `UPDATE institute_custom_fields SET status='ACTIVE' WHERE … updated_at >= '<your timestamp>'` for the rows you touched. Better: replay from the `pg_dump`. |
| 5 (value repointing) | **Cannot be reversed without the `pg_dump`.** Restore the `custom_field_values` rows from the dump and re-apply Step 5 with corrected mappings. |
| 6 (master soft-delete) | `UPDATE custom_fields SET status='ACTIVE' WHERE id IN (…)` |
| 7 (JSON blob refresh) | Restore `institutes.setting` from the dump for that one institute id. |

If you discover a problem **before** Step 5: each `BEGIN; … COMMIT;` block is a self-contained transaction; just `ROLLBACK` the open one.

---

## 14. Optional follow-ups

After every affected production institute is clean, consider these schema-level guards. These are **deferred** because they require a coordinated deploy and a separate runbook of their own — do not run as part of this cleanup:

- **Add a SQL UNIQUE index on `custom_fields(field_key) WHERE status = 'ACTIVE'`** to prevent duplicate masters from re-appearing. Bug B-23 in [CUSTOM_FIELDS_ADMIN_FLOWS_AND_ISSUES.md](CUSTOM_FIELDS_ADMIN_FLOWS_AND_ISSUES.md#b-23-custom_fieldsfield_key-has-no-sql-unique-constraint--duplicates-accumulate). Will fail until **every** institute has been cleaned.
- **Add a partial UNIQUE index on `institute_custom_fields(institute_id, custom_field_id, type, COALESCE(type_id,'')) WHERE status = 'ACTIVE'`** to prevent mapping inflation regression. Same caveat — will fail on un‑cleaned institutes.
- **Backfill `custom_fields.is_mandatory = false` and rely solely on `institute_custom_fields.is_mandatory`** going forward. Drops the dual-source-of-truth bug B-2.
- **Drop the legacy `learner_invitation_custom_field` and `learner_invitation_custom_field_response` tables** (Bug B-20) once usage is fully migrated to the unified system.

---

## See also

- [CUSTOM_FIELDS.md](CUSTOM_FIELDS.md) — full technical reference (schema, services, the new revamp)
- [CUSTOM_FIELDS_ADMIN_FLOWS_AND_ISSUES.md](CUSTOM_FIELDS_ADMIN_FLOWS_AND_ISSUES.md) — admin user flows and the bugs that necessitated this cleanup
