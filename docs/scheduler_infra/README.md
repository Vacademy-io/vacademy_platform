# Scheduler Infrastructure — Single-Instance `@Scheduled` Jobs (ShedLock)

**Status:** infra in place in `admin_core_service` (built 2026-07-16). 8 lead-domain jobs locked; ~19 other `@Scheduled` jobs still fan out (see [Backlog](#backlog)).

This doc explains how scheduled jobs are made to run on **one replica at a time** instead of on every pod, and how to add a new job to that scheme.

---

## The problem

`admin_core_service` runs with **4 replicas**. Spring's `@Scheduled` has **no leader election** — the scheduler runs independently inside every pod, so **every scheduled job fires on all 4 pods on every tick**.

Observed in prod (Meta lead poller, `0 */10 * * * ?`): all four replicas ran the same tick within ~1.5 s and each fetched the same leads.

```
18:40:14.398  pod-4cz2p  MetaLeadPollingJob: polled 40 connector(s), fetched 3 lead(s)
18:40:14.462  pod-4mhqx  MetaLeadPollingJob: polled 40 connector(s), fetched 3 lead(s)
18:40:15.638  pod-plz4m  MetaLeadPollingJob: polled 40 connector(s), fetched 3 lead(s)
18:40:15.920  pod-8bcb7  MetaLeadPollingJob: polled 40 connector(s), fetched 3 lead(s)
```

Consequences:

- **4× redundant work** — 4× the external API calls (Meta Graph, Zoom, Airtel, …), 4× the DB load, 4× the token-in-URL exposure.
- **Amplified races on non-idempotent side effects.** A job that inserts rows, sends messages, assigns work, or charges money can do it up to 4× if it isn't internally idempotent. For the lead poller this widened the check-then-insert dedup window (still held — 0 duplicates verified — but the margin shrank).

The codebase already flagged this for one subsystem (`features/enrollment_policy/SCHEDULER_TECHNICAL_DEEP_DIVE.md`: *"The scheduler uses `@Scheduled` with no distributed coordination. In any multi-instance deployment…"*).

---

## The solution: ShedLock (JDBC)

[ShedLock](https://github.com/lukas-krecan/ShedLock) makes a `@Scheduled` method acquire a **shared lock in Postgres** before it runs. On a tick, the first pod to grab the lock runs the job; the other three see it held and **skip that tick**. When the job finishes, the lock is released.

It is a **lock, not a queue** — the goal is "run once per schedule", not "run somewhere eventually". A skipped tick is correct behaviour (the winning pod already did the work).

### Components

| Piece | Location |
|---|---|
| Dependencies | `admin_core_service/pom.xml` — `net.javacrumbs.shedlock:shedlock-spring` + `shedlock-provider-jdbc-template` (5.13.0) |
| Config / provider | `config/ShedLockConfig.java` — `@EnableSchedulerLock`, `LockProvider` bean |
| Lock table | `db/migration/V382__shedlock_table.sql` — the `shedlock` table |
| Per-job opt-in | `@SchedulerLock(...)` on the `@Scheduled` method |

### Key config choices (`ShedLockConfig`)

```java
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")
public class ShedLockConfig {
    @Bean
    public LockProvider lockProvider(@Qualifier("masterDataSource") DataSource dataSource) {
        return new JdbcTemplateLockProvider(
            JdbcTemplateLockProvider.Configuration.builder()
                .withJdbcTemplate(new JdbcTemplate(dataSource))
                .usingDbTime()          // compare lock times against the DB clock, not each pod's
                .build());
    }
}
```

- **`masterDataSource`, not the routing/`@Primary` datasource.** Locks are writes and must go to the writable primary, never the read replica. (`DataSourceConfiguration` exposes a master/slave routing proxy; we bind ShedLock to the raw `masterDataSource` bean.)
- **`usingDbTime()`** — lock expiry is evaluated against the **database** clock. Without it, clock skew between the 4 pods could let two of them think the lock is free at the same instant. With it, there is a single source of truth for time.

### The lock table (unchanged ShedLock schema — do not rename columns)

```sql
CREATE TABLE IF NOT EXISTS shedlock (
    name       VARCHAR(64)  NOT NULL,   -- one row per job (the @SchedulerLock name)
    lock_until TIMESTAMP    NOT NULL,   -- lock is held until this instant
    locked_at  TIMESTAMP    NOT NULL,
    locked_by  VARCHAR(255) NOT NULL,   -- hostname of the holding pod
    PRIMARY KEY (name)
);
```

One row per job. `PRIMARY KEY (name)` is what makes acquisition atomic.

---

## Jobs locked today

All in the lead / audience domain (the area where 4× execution risked duplicate lead side effects).

| Job | Schedule | `lockAtMostFor` | Why locked |
|---|---|---|---|
| `MetaLeadPollingJob` | every 10 min | `PT9M` | 4× lead ingest → dedup-race amplification |
| `MetaTokenRefreshJob.refreshExpiringMetaTokens` | daily 02:00 | `PT30M` | 4× token rotation; lost-update risk |
| `MetaTokenRefreshJob.expireOldOAuthSessions` | hourly | `PT5M` | redundant bulk update |
| `MetaConnectorMonitorJob` | daily 02:30 | `PT30M` | 4× health sweep + Sentry alerts |
| `InactivityOptOutScanner` | daily 07:00 | `PT30M` | **fires lead actions** — 4× → duplicate opt-outs |
| `LeadAutomationScheduler` | every 30 min | `PT25M` | **fires lead automations** — 4× → duplicate actions |
| `LeadScoringService.batchRecalculatePercentiles` | every 15 min | `PT14M` | redundant full recompute |
| `UserLeadProfileService.batchRebuildProfiles` | every 30 min | `PT29M` | ~15 min job × 4 = heavy waste |

> All eight were confirmed to have **no direct (non-scheduler) callers** before annotating — see the caveat in [Adding a job](#adding-a-scheduled-job-to-the-lock).

---

## Adding a `@Scheduled` job to the lock

1. **Confirm the method is invoked only by the scheduler.** `@SchedulerLock` intercepts *every* call to the method, not just scheduled ones. If a controller or another service also calls it directly (e.g. a manual "recalculate now"), that call would also contend for the lock and could be skipped. Check first:
   ```bash
   grep -rn "myScheduledMethod" admin_core_service/src/main/java | grep -v "void myScheduledMethod"
   ```
   If there are real callers, either don't lock it, or extract the body into a separate un-annotated method and lock only the scheduler entry point.

2. **Annotate:**
   ```java
   import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;

   @Scheduled(cron = "...")
   @SchedulerLock(name = "UniqueJobName", lockAtMostFor = "PT9M", lockAtLeastFor = "PT10S")
   public void myScheduledMethod() { ... }
   ```
   - `name` — **globally unique**, ≤ 64 chars. Convention: `ClassName` for single-method jobs, `ClassName_methodName` when a class has several. This string is the `shedlock.name` row.
   - No new migration or config is needed — the infra is already wired.

3. That's it. Non-annotated `@Scheduled` methods are unaffected, so you can roll jobs onto the lock one at a time.

### Choosing `lockAtMostFor` / `lockAtLeastFor`

- **`lockAtMostFor`** — the *safety* timeout. If the holding pod **crashes** mid-run, the lock is auto-released after this long (a live pod releases immediately on method return — this only matters for crashes). **Set it comfortably longer than the job's worst-case runtime**, and ideally shorter than the interval so a crash doesn't block more than ~one tick. If a job can plausibly run longer than its interval, prefer a value above the worst-case runtime and accept a possible skipped tick after a crash.
  - _Rule of thumb used above:_ a bit under the interval for short jobs (`PT9M` for a 10-min job), and above the observed max runtime for long ones (`PT29M` for a 30-min job that has taken ~15 min).
- **`lockAtLeastFor`** — hold the lock for at least this long *even if the job returns instantly*. Guards against a fast job double-firing under clock skew. Small values (`PT10S`–`PT1M`) are fine; keep it well under the interval.

---

## Operating & verifying

**Confirm single-instance execution (post-deploy):** the job's summary log line should appear on **one** pod per tick, not four.
```bash
kubectl --kubeconfig=<prod> logs -l app=admin-core-service --prefix --since=30m --max-log-requests=8 \
  | grep "MetaLeadPollingJob: polled"
# expect ~1 line per 10-min tick, from varying pods — not 4 lines per tick
```

**Inspect current locks:**
```sql
SELECT name, locked_by, locked_at, lock_until,
       (lock_until > now()) AS currently_held
FROM shedlock ORDER BY locked_at DESC;
```

**Force the next tick to re-run (clear a stuck/held lock)** — safe; the row is recreated on next acquisition:
```sql
DELETE FROM shedlock WHERE name = 'MetaLeadPollingJob';
```
(You normally never touch this table; ShedLock manages it.)

---

## Gotchas / invariants

- **Only annotated methods are locked.** Adding the infra changed nothing about the ~19 jobs that still lack `@SchedulerLock`; they keep running on all pods. This is why the rollout is safe and incremental.
- **The method must be a public method on a Spring bean** (ShedLock works via an AOP proxy). Private/self-invoked methods aren't intercepted.
- **`@SchedulerLock` + `@Transactional` order is correct by default.** ShedLock's aspect runs at highest precedence, so the lock is acquired *before* the transaction begins and released *after* it commits.
- **Lock provider must target the master DB** (`@Qualifier("masterDataSource")`). Pointing it at the read replica would fail on write.
- **`pgbouncer` (transaction pooling) is fine** — ShedLock uses short transactions; `usingDbTime()` reads DB time within them.
- **`name` collisions are silent correctness bugs** — two jobs sharing a `name` would block each other. Keep names unique.

---

## Backlog

~19 `@Scheduled` methods across other subsystems still fan out to all 4 replicas. Adding `@SchedulerLock` is a one-line change each (after the direct-caller check above). Prioritised by blast radius:

**High priority — non-idempotent / financial:**
- `payments/EwayPoolingService` — payment pooling.
- `telephony/CallBillingReconciliationJob` — billing reconciliation (money).
- `telephony/AirtelCcrImportScheduler`, `telephony/AirtelImportPromoterScheduler` — CDR import/promotion → duplicate lead attribution.
- `enrollment_policy/PackageSessionScheduler` (3 methods) — the subsystem whose own doc flags the missing coordination.
- `workflow/WorkflowWatchdogJob` — re-queues stuck workflows.
- `youtube/YoutubeUploadJobWorker`, `youtube/YoutubeUploadJobRepository` — uploads.

**Lower priority — mostly wasteful / self-correcting:**
- `live_session/*` — `ZoomRecordingSyncProcessor`, `ZoomRecordingS3SyncProcessor`, `ZoomAttendanceSyncProcessor`, `ZoomMeetingProvisionRetryProcessor`, `GoogleMeetRecordingSyncProcessor` (5× redundant Zoom/Meet sync — also multiplies transient Zoom-API error noise by 4).
- `learner_tracking/ActivityLogProcessorService`, `admin_activity_logs/AdminActivityLogRetentionJob` — log processing/retention.
- `ai_content/TranscriptionReconciliationJob`, `counsellor_rating/CounsellorRatingScheduler`.

Before locking any of these, verify idempotency and direct callers per job — some may already guard themselves (e.g. the `tryClaimAiCampaign` conditional-update pattern used elsewhere).

---

## References

- Config: `admin_core_service/.../config/ShedLockConfig.java`
- Migration: `admin_core_service/.../db/migration/V382__shedlock_table.sql`
- Example locked jobs: `admin_core_service/.../features/audience/job/MetaLeadPollingJob.java`
- Datasource wiring: `admin_core_service/.../config/db/DataSourceConfiguration.java` (`masterDataSource`)
- Scheduling enabled at: `AdminCoreServiceApplication` (`@EnableScheduling`)
- ShedLock docs: https://github.com/lukas-krecan/ShedLock
