# Feature: Auto-Create Opt-Out Audience on First Unsubscribe

## Problem

Currently, `AudienceOptOutService.moveUserToOptOutAudience` looks for an existing audience
with `campaign_type LIKE '%OPT_OUT%'`. If none exists for the institute, it logs a warning
and **drops the user** — they are only stored in `user_announcement_settings`, never in the
audience system.

This means institutes that have never manually created an opt-out audience will silently lose
opt-out CRM tracking and workflow capability.

---

## Chosen Solution: Lazy Auto-Create (Option A)

When a user opts out and no opt-out audience exists for the institute, **auto-create one on
the spot** with sensible defaults, then immediately add the user to it.

No manual setup required. Works for all existing and new institutes automatically.

---

## What Changes

### `AudienceOptOutService.java` — only file that needs to change

Replace this block:

```java
Optional<Audience> optOutAudienceOpt = audienceRepository.findOptOutAudienceByInstituteId(instituteId);
if (optOutAudienceOpt.isEmpty()) {
    log.warn("No opt-out audience found for institute {}. Skipping audience move.", instituteId);
    return;
}
Audience optOutAudience = optOutAudienceOpt.get();
```

With:

```java
Audience optOutAudience = audienceRepository
        .findOptOutAudienceByInstituteId(instituteId)
        .orElseGet(() -> createDefaultOptOutAudience(instituteId));
```

Add a new private method `createDefaultOptOutAudience`:

```java
private Audience createDefaultOptOutAudience(String instituteId) {
    Audience audience = new Audience();
    audience.setInstituteId(instituteId);
    audience.setCampaignName("Opt Out");
    audience.setCampaignType("OPT_OUT");
    audience.setStatus("ACTIVE");
    audience.setStartDate(Timestamp.valueOf(LocalDateTime.now()));
    audience.setEndDate(Timestamp.valueOf(LocalDateTime.now().plusYears(10)));
    Audience saved = audienceRepository.save(audience);
    log.info("Auto-created opt-out audience {} for institute {}", saved.getId(), instituteId);
    return saved;
}
```

> Inject `AudienceRepository` into the service — it is already injected, no new dependency needed.

---

## What Does NOT Change

- `AudienceRepository.findOptOutAudienceByInstituteId` — no change needed
- `AudienceResponseRepository` — no change needed
- `notification_service` — no change needed
- DB schema — no change needed
- All existing opt-out audiences already in DB continue to work as-is

---

## Behaviour After the Change

| Scenario | Before | After |
|---|---|---|
| Institute has opt-out audience | Works correctly | Same |
| Institute has NO opt-out audience | User dropped, warning logged | Audience auto-created, user added |
| Second user opts out (same institute) | Dropped again | Uses the auto-created audience |

---

## Things to Note

1. **Workflows**: The auto-created audience has no workflows configured. The institute admin
   needs to set up workflows manually in the admin UI if they want follow-up messaging for
   opted-out users.

2. **Audience visibility**: The auto-created audience will appear in the admin UI under
   Audiences — admins can rename it, set description, configure workflows, etc.

3. **No duplicate creation**: `findOptOutAudienceByInstituteId` uses `LIKE '%OPT_OUT%'`,
   so if admin later renames the audience or adds another OPT_OUT audience, it will be picked
   up correctly. Only one should exist per institute.

4. **Idempotency concern**: If two simultaneous opt-outs arrive for the same institute with
   no existing opt-out audience, there is a small race window where two audiences could be
   created. Mitigation: add a `UNIQUE` constraint on `(institute_id, campaign_type)` in DB,
   or add a `findOrCreate` with `saveAndFlush` + retry. Low priority — rare in practice.

---

## Files to Touch

| File | Change |
|---|---|
| `admin_core_service/.../service/AudienceOptOutService.java` | Replace warning+return with auto-create logic |

That's it — one file, two changes (replace block + add private method).

---

## Testing Checklist

- [ ] Institute with existing opt-out audience → user added to existing audience (no duplicate created)
- [ ] Institute with NO opt-out audience → audience auto-created, user added
- [ ] Second opt-out from same institute (no prior audience) → reuses auto-created audience
- [ ] Auto-created audience appears in admin UI
- [ ] Opted-out user does NOT appear in normal audience lead lists
- [ ] Opted-out user DOES appear when querying the opt-out audience directly
