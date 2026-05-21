# Admin Activity Logs

A transactional audit log of administrative mutations in `admin_core_service`. Every annotated controller method writes one row to `admin_activity_log` **inside** the same database transaction as the wrapped business call, so audit rows can never exist without their action and vice versa.

The feature is **opt-in per endpoint** via the `@Auditable` annotation. If a method doesn't carry the annotation, nothing runs — no bytecode, no allocation, zero overhead.

---

## How to instrument a new endpoint

### Minimum required

Add `@Auditable` to the controller method (it works on service methods too, but controllers are where the request context and `clientId` header live, so prefer controllers).

```java
import vacademy.io.admin_core_service.features.admin_activity_logs.annotation.Auditable;

@PostMapping("/add-course/{instituteId}")
@Auditable(
    entityType = "COURSE",
    action = "CREATE",
    entityIdExpr = "#result",
    descriptionExpr = "'created course ' + #addCourseDTO?.courseName"
)
public String addCourse(@RequestBody AddCourseDTO addCourseDTO,
                        @PathVariable String instituteId,
                        @RequestAttribute("user") CustomUserDetails userDetails) {
    return courseService.addCourse(addCourseDTO, userDetails, instituteId);
}
```

That single annotation produces a row like:

```
{
  actor_name: "John Doe",
  actor_email: "john@vacademy.io",
  entity_type: "COURSE",
  entity_id: "7bd4615a-...",
  action: "CREATE",
  description: "created course Mathematics 101",
  http_method: "POST",
  endpoint: "/admin-core-service/course/v1/add-course/{instituteId}",
  request_payload: { courseName: "Mathematics 101", ... },
  response_status: 200,
  response_time_ms: 87
}
```

The frontend renders this in `/admin-activity-logs` as **"John Doe created course Mathematics 101"** (the entity name "Mathematics 101" is auto-bolded by a pattern matcher in [ActivityLogTable.tsx](../frontend-admin-dashboard/src/routes/admin-activity-logs/-components/ActivityLogTable.tsx)).

### Annotation fields

| Field | Required | Type | Purpose |
|---|---|---|---|
| `entityType` | yes | String | Logical resource type, uppercase snake. Used to filter audit rows. Examples: `COURSE`, `LIVE_SESSION`, `LEARNER`, `INSTITUTE_SETTING`. New types are free-form — add to the frontend's `RESOURCE_OPTIONS` dropdown in [ActivityLogFilters.tsx](../frontend-admin-dashboard/src/routes/admin-activity-logs/-components/ActivityLogFilters.tsx) once you start emitting them. |
| `action` | yes | String | Logical action, uppercase. Examples: `CREATE`, `UPDATE`, `DELETE`, `CANCEL`, `ENROLL`, `PUBLISH`. Same dropdown convention as above (`ACTIVITY_OPTIONS`). |
| `entityIdExpr` | optional | SpEL | Returns the id of the affected entity. Pulled from method args, `#user`, or `#result`. Example: `"#courseId"`, `"#result"`, `"#req?.id"`. |
| `descriptionExpr` | optional but recommended | SpEL | Produces the human-readable verb-and-object fragment ("created course X"). Actor name is prepended automatically by the frontend, so don't include the actor. |
| `captureBefore` | optional | SpEL | Evaluated *before* the wrapped method runs. Used for UPDATE/DELETE to snapshot the entity's prior state. Supports bean references — see the example below. |
| `payload` | optional | enum | `FULL` / `REDACTED` (default) / `NONE`. `REDACTED` masks fields named `password`, `token`, `otp`, `cardNumber`, `cvv`, `secret`, `apiKey` (case-insensitive). `NONE` omits the body. |
| `maxPayloadBytes` | optional | int | Caps the serialized payload size (default 64,000). Bodies above this are truncated with `...[truncated]`. Set lower for bulk-import endpoints with multi-MB bodies. |
| `async` | optional | bool | Default `false` = audit row written in the same transaction as the business call (atomic, crash-safe). `true` = fire-and-forget on a separate executor. **Use only on documented bulk endpoints where atomicity isn't required.** |

### SpEL context variables

Inside any SpEL expression on the annotation, these are available:

- **Method parameter names** — every `@RequestBody`, `@PathVariable`, `@RequestParam`, etc. is bound by its parameter name. `#courseId`, `#instituteId`, `#addCourseDTO?.courseName`, etc. Use `?.` safe-navigation to avoid NPEs on null DTOs.
- **`#user`** — the `CustomUserDetails` extracted from `@RequestAttribute("user")` if present in the method args.
- **`#result`** — the return value of the wrapped method. Available in `entityIdExpr` and `descriptionExpr` (evaluated *after* the call). For controllers returning `ResponseEntity<X>`, use `#result?.body?.id`.
- **`#before`** — the result of `captureBefore` (raw object, not JSON). Lets `descriptionExpr` reference data that only existed before the mutation — e.g., names of rows being deleted.
- **`@beanName.method(args)`** — Spring bean references via the configured `BeanFactoryResolver`. Useful for `captureBefore` to call a service method that loads the current entity.

### Bean references (the killer feature for `captureBefore`)

Use `@beanName.method(...)` to invoke a Spring bean from SpEL. The bean name follows the standard Spring convention (camelCase class name).

```java
@Auditable(
    entityType = "INSTITUTE_SETTING",
    action = "UPDATE",
    entityIdExpr = "#instituteId",
    descriptionExpr = "'updated certificate settings'",
    captureBefore = "@instituteSettingManager.getSettingData(#userDetails, #instituteId, 'CERTIFICATE_SETTING').body"
)
```

The aspect resolves `@instituteSettingManager` to the `InstituteSettingManager` Spring bean, calls `getSettingData(...)` with the request's args, and stores the returned object as JSON in the `before_payload` column. The frontend's drawer renders this as a side-by-side **Before → After** view.

If the bean call throws (entity not found, etc.), the aspect catches silently — the audit row still writes with `before_payload = null`.

---

## Examples

### CREATE — name from request body

```java
@PostMapping("/add-course/{instituteId}")
@Auditable(
    entityType = "COURSE",
    action = "CREATE",
    entityIdExpr = "#result",
    descriptionExpr = "'created course ' + #addCourseDTO?.courseName"
)
public String addCourse(@RequestBody AddCourseDTO addCourseDTO, ...) { ... }
```

### UPDATE — fallback to id when name is missing

```java
@PutMapping("/update-course/{courseId}")
@Auditable(
    entityType = "COURSE",
    action = "UPDATE",
    entityIdExpr = "#packageId",
    descriptionExpr = "'updated course ' + (#packageDTO?.name ?: #packageId)"
)
public String updateCourse(@RequestBody PackageDTO packageDTO,
                            @PathVariable("courseId") String packageId, ...) { ... }
```

The Elvis `?:` falls back to `#packageId` when the DTO's `name` field is null.

### DELETE — capture names *before* the row is gone

```java
@DeleteMapping("/delete-courses")
@Auditable(
    entityType = "COURSE",
    action = "DELETE",
    entityIdExpr = "T(java.lang.String).join(',', #courseIds)",
    captureBefore = "@packageRepository.findAllById(#courseIds).![packageName]",
    descriptionExpr = "#before != null and !#before.isEmpty() ? "
            + "'deleted course ' + T(java.lang.String).join(', ', #before) : "
            + "'deleted ' + #courseIds.size() + ' course(s)'"
)
public String deleteCourse(@RequestBody List<String> courseIds, ...) { ... }
```

- `@packageRepository.findAllById(#courseIds)` returns `List<PackageEntity>` (the JPA repo's `findAllById` is free with `JpaRepository`).
- `.![packageName]` is SpEL's projection operator — projects each entity to its `packageName` field, yielding `List<String>` of names.
- `descriptionExpr` references the projected list as `#before` and joins with commas.
- Ternary fallback: if the lookup failed or returned empty, the description degrades to a count.

Output row: `John deleted course Mathematics 101, Physics 201, Chemistry 110`.

### Bulk — count when individual names aren't meaningful

```java
@PostMapping("/delete")
@Auditable(
    entityType = "LIVE_SESSION",
    action = "DELETE",
    descriptionExpr = "'deleted ' + (#request?.ids?.size() ?: 0) + ' live session(s)'"
)
public ResponseEntity<?> deleteLiveSessions(@RequestBody DeleteLiveSessionRequest request, ...) { ... }
```

### Settings UPDATE — before/after diff

```java
@PostMapping("/save-setting")
@Auditable(
    entityType = "INSTITUTE_SETTING",
    action = "UPDATE",
    entityIdExpr = "#instituteId",
    descriptionExpr = "'updated ' + #settingKey?.toLowerCase()?.replace('_', ' ')",
    captureBefore = "@instituteSettingManager.getSettingData(#userDetails, #instituteId, #settingKey).body"
)
public ResponseEntity<String> saveSetting(@RequestAttribute("user") CustomUserDetails userDetails,
                                            @RequestParam("instituteId") String instituteId,
                                            @RequestParam("settingKey") String settingKey,
                                            @RequestBody GenericSettingRequest request) { ... }
```

The drawer in the audit-log UI shows the prior setting JSON on the left and the new (request) payload on the right, with copy-to-clipboard buttons on each.

---

## Frontend description rendering

The audit table renders each row as `**{actor_name}** {description}`. The entity name at the end of the description is auto-bolded by regex match in [ActivityLogTable.tsx](../frontend-admin-dashboard/src/routes/admin-activity-logs/-components/ActivityLogTable.tsx). Patterns currently matched:

| Backend `descriptionExpr` outputs | Renders as |
|---|---|
| `created course X` | created course **X** |
| `updated course X` | updated course **X** |
| `deleted course X, Y, Z` | deleted course **X, Y, Z** |
| `scheduled live session X` | scheduled live session **X** |
| `created booking X` | created booking **X** |
| `enrolled learner X` | enrolled learner **X** |
| `re-enrolled learner X` | re-enrolled learner **X** |
| `switched WhatsApp provider to X` | switched WhatsApp provider to **X** |
| `updated WhatsApp credentials for X` | updated WhatsApp credentials for **X** |
| `removed WhatsApp credentials for X` | removed WhatsApp credentials for **X** |

If your new endpoint emits a verb-noun phrase the frontend doesn't recognize, the description renders as plain text (no bolding). That's fine — adding a new pattern is a one-line regex addition in `NAMED_DESCRIPTION_PATTERNS`.

---

## Display Settings gating

The `/admin-activity-logs` route ships **hidden** for every institute. Admin owners opt in via **Settings → Display Settings → Sidebar Tabs** → toggle "Admin Activity Logs" on.

Gating happens in three places — keep them in sync if you ever rename the tab ID:

1. The tab ID `'admin-activity-logs'` must be in `controlledTabs` ([constant.ts](../frontend-admin-dashboard/src/components/common/layout-container/sidebar/constant.ts)).
2. The admin defaults set `visible: false` via `OPT_IN_TAB_IDS` ([admin-defaults.ts](../frontend-admin-dashboard/src/constants/display-settings/admin-defaults.ts)).
3. The route's `beforeLoad` hook redirects to `/dashboard` if the tab is disabled ([routes/admin-activity-logs/index.tsx](../frontend-admin-dashboard/src/routes/admin-activity-logs/index.tsx)).

Once the institute enables it, anyone with the `ADMIN` role can view the log (the sidebar item itself is filtered to admins via `filterSidebarByRole` in [helper.ts](../frontend-admin-dashboard/src/components/common/layout-container/sidebar/helper.ts)).

---

## How the transactional outbox actually works

1. Spring AOP weaves `AuditableAspect#audit(...)` around any method annotated with `@Auditable`.
2. The aspect's `@Around` method is itself `@Transactional(Propagation.REQUIRED)`. So:
   - When the advice begins, an outer transaction opens (or it joins an existing one).
   - `joinPoint.proceed()` invokes the controller, which calls the service. The service's own `@Transactional` participates in the outer transaction by default.
   - On return, the aspect builds the `AdminActivityLog` row and calls `repository.save(log)` — this INSERT participates in the same transaction.
   - The outer transaction commits → business changes + audit row land atomically in WAL.
   - If the wrapped method throws, the transaction rolls back. Both the business changes and the audit row roll back. **There is never an audit row without a successful action.**
3. The aspect is `@Order(Ordered.LOWEST_PRECEDENCE - 10)` so it wraps Spring's `@Transactional` advice from the outside.

For `async = true`, the aspect skips the in-transaction write and dispatches the row to a dedicated `ThreadPoolTaskExecutor` named `auditAsyncExecutor`. The async write runs in `Propagation.REQUIRES_NEW`, so a failure there doesn't roll back the business commit. **Use sparingly** — async loses the atomicity guarantee.

---

## Performance characteristics

| | Without `@Auditable` | With `@Auditable` (default sync) | With `captureBefore` | With `async = true` |
|---|---|---|---|---|
| Per-call latency added | 0 | ~1–2 ms | ~3–8 ms (extra SELECT) | ~15–35 μs (snapshot + executor submit) |
| Extra DB hits | 0 | +1 INSERT | +1 SELECT, +1 INSERT | 0 in the request path; +1 INSERT off-thread |
| Connection pool pressure | 0 | Uses the request's existing connection | Same | One slot per concurrent async write |
| Atomicity with business txn | n/a | Yes | Yes | **No** |

A typical admin mutation takes 50–500 ms end-to-end. Audit overhead is **<1% of that** in the worst case. Storage growth is bounded by retention.

The aspect uses Spring's compiled SpEL (`SpelCompilerMode.MIXED`) — hot expressions are promoted to bytecode after a few invocations, so SpEL evaluation is single-digit microseconds in steady state.

---

## Failure modes (handled — no business call ever fails because of audit)

| Failure | What happens |
|---|---|
| `clientId` header missing | Aspect skips the audit row write; logs DEBUG; the business call proceeds normally. |
| SpEL expression throws (e.g., typo in `entityIdExpr`) | Aspect catches, logs WARN, sets that field to null. Row still writes; other fields are unaffected. |
| `captureBefore` bean call throws (e.g., entity not found yet) | Aspect catches; `before_payload` stays null; row still writes. |
| `repository.save(log)` throws | Aspect catches; logs ERROR; **business transaction is NOT rolled back**. Audit data is lost for that one call but the customer's mutation succeeds. |
| Payload above `maxPayloadBytes` | JSON is truncated with `...[truncated]` suffix. |
| JVM crash mid-mutation | Postgres rolls back; both business changes and audit row gone — consistent. |
| JVM crash post-commit | Both are durable in WAL. No data loss either way. |

The hard rule: **an audit issue never breaks a customer-facing API**.

---

## Retention

Rows older than `audit.retention.days` (default 365) are hard-deleted by `AdminActivityLogRetentionJob` running at `0 0 3 * * *` UTC. The job chunks the DELETE in batches of 5,000 (`audit.retention.batch-size`) so row locks stay short — never holds a table lock, no live-traffic impact. Total run time for a normal day's expired rows is 1–2 seconds.

Tunable via `application.properties`:

```properties
audit.retention.days=365
audit.retention.batch-size=5000
audit.payload.default-max-bytes=64000
audit.async.executor.core=2
audit.async.executor.max=5
audit.async.executor.queue=200
```

---

## CSV export

`GET /admin-core-service/audit/v1/logs/export.csv` streams a CSV of all rows matching the active list filters (date range, resource, activity, actor). Hard-capped at 50,000 rows server-side to prevent runaway exports. Columns: `When (UTC), Actor name, Actor email, Activity, Action, Resource, Entity ID, HTTP method, Endpoint, Status, Latency (ms), IP address`. JSON payloads are intentionally omitted — they're available per-row via `GET /logs/{id}`.

The frontend's "Export CSV" button passes whatever filters are currently set, so admins control the scope by adjusting the date range and dropdowns before clicking.

---

## Architecture decisions you'll inherit

- **Why transactional outbox and not in-memory queue + batch writer?** Earlier design used `ArrayBlockingQueue` + a daemon consumer for throughput. Switched to the outbox because admin mutation volume is in the tens/sec, never thousands/sec, so the +1 ms per call is invisible. The outbox gives crash-safety and atomicity-with-business-txn for free. The `async = true` escape hatch is the only place the original queue idea survives.
- **Why does it live in `admin_core_service` and not `common_service`?** 99% of admin mutations are here today. If `assessment_service` or another service ever wants to audit, we move just the `annotation/`, `aspect/`, `util/` packages into `common_service` (about a half-day's work). The table + read API + UI naturally belong to the admin app and would stay here regardless.
- **Why one `admin_activity_log` table, not one per service?** Cross-service queries ("show me everything user X did across the platform") become trivial. The trade-off is that if a non-admin service wants to write here, it needs DB access to the admin-core DB. We'll cross that bridge when we get there.
- **Why opt-in `@Auditable` and not a global HTTP interceptor that logs every mutation?** Interceptors can't capture semantic metadata (entity_id, human description) without a giant URL-pattern matcher. Opt-in per method also means deployments don't suddenly start logging unintended endpoints. Lower blast radius.

---

## File reference

Backend — `admin_core_service/src/main/java/vacademy/io/admin_core_service/features/admin_activity_logs/`:

| Path | Purpose |
|---|---|
| `annotation/Auditable.java` | The annotation itself. Source of truth for fields. |
| `aspect/AuditableAspect.java` | The `@Around` advice — request snapshot, SpEL eval, JSON serialization, save. |
| `async/AsyncAuditDispatcher.java` | Off-thread persister for `async = true`. |
| `config/AuditAsyncExecutorConfig.java` | The `auditAsyncExecutor` `ThreadPoolTaskExecutor` bean. |
| `config/AuditProperties.java` | `@ConfigurationProperties("audit")` tunables. |
| `controller/AdminActivityLogController.java` | `GET /logs`, `GET /logs/{id}`, `GET /logs/export.csv`. |
| `entity/AdminActivityLog.java` | JPA entity. JSONB columns for `request_payload` and `before_payload`. |
| `repository/AdminActivityLogRepository.java` | `JpaRepository + JpaSpecificationExecutor`; chunked retention DELETE native query. |
| `retention/AdminActivityLogRetentionJob.java` | Nightly chunked DELETE. |
| `service/AdminActivityLogReadService.java` | Filter spec + CSV builder. |
| `service/PayloadRedactor.java` | Sensitive-key masking before JSON serialization. |
| `util/AuditSpelEvaluator.java` | Cached SpEL parser + `BeanFactoryResolver` wiring. |
| `util/RequestContextSnapshot.java` | Immutable POJO for the request-thread context. |

Migration: `src/main/resources/db/migration/V259__Admin_activity_log.sql`.

POM: `spring-boot-starter-aop` added in `admin_core_service/pom.xml`.

Frontend — `frontend-admin-dashboard/src/routes/admin-activity-logs/`:

| Path | Purpose |
|---|---|
| `index.tsx` | Route registration + `beforeLoad` toggle gate. |
| `index.lazy.tsx` | Page shell + state plumbing. |
| `-components/ActivityLogFilters.tsx` | Resource / Activity dropdowns, date range, refresh, **Export CSV** button. |
| `-components/ActivityLogTable.tsx` | The table — relative timestamps, status dots, sentence rendering with entity-name bolding. |
| `-components/PayloadDrawer.tsx` | Side drawer with Before → After JSON view and copy buttons. |

Service hook: `frontend-admin-dashboard/src/services/admin-activity-logs/getActivityLogs.ts`.

Display-settings integration: `sidebar/constant.ts` (`controlledTabs`), `sidebar/helper.ts` (`adminOnlyIds`), `constants/display-settings/admin-defaults.ts` + `teacher-defaults.ts` (default-off).

---

## Gotchas

1. **`@Auditable` on the controller, not the service.** The request context (`clientId` header, `user` attribute, IP, user-agent) is thread-bound to the request thread. Putting the annotation on a deeper service method means the aspect can still snapshot context (it uses `RequestContextHolder`), but if the service is called from a non-request thread — e.g., a `@Scheduled` job — the snapshot is null and the row is skipped. Controllers are always called on the request thread.

2. **SpEL is evaluated at runtime — typos compile but break at first invocation.** The aspect catches the throw and logs a WARN, but the column ends up null. Always grep your logs once for `SpEL evaluation failed for expression` after adding a new annotation.

3. **`#result` is null in `captureBefore`.** The before-snapshot runs *before* `proceed()`, so `#result` doesn't exist yet. Only the method args, `#user`, and `@bean` references are available in `captureBefore` expressions.

4. **JpaRepository `findAllById` is your friend.** For `captureBefore` on DELETE operations, `@repositoryName.findAllById(#ids).![fieldName]` gives you a `List<String>` of the field projections in one query. Pair with `T(java.lang.String).join(', ', #before)` in `descriptionExpr` to produce comma-joined names.

5. **PayloadMode.NONE on file-upload endpoints.** If your endpoint takes a `MultipartFile`, set `payload = PayloadMode.NONE` — Jackson will try to serialize the multipart and either explode or produce useless binary. The action + actor are still captured.

6. **Adding to the frontend dropdowns.** New `entityType` / `action` values will work in the backend immediately but won't appear in the filter dropdowns until they're added to `RESOURCE_OPTIONS` / `ACTIVITY_OPTIONS` in [ActivityLogFilters.tsx](../frontend-admin-dashboard/src/routes/admin-activity-logs/-components/ActivityLogFilters.tsx). Filters still accept any string typed/pasted, just no autocomplete.

7. **The `clientId` header is required.** The axios interceptor in [axiosInstance.ts](../frontend-admin-dashboard/src/lib/auth/axiosInstance.ts) attaches it automatically from `getInstituteId()`. If you ever build a non-axios request path (e.g., a worker-side fetch), make sure that header is included or audit silently drops the row.

---

## Future improvements (not yet wired)

- **Promote annotation + aspect to `common_service`** so other services can audit into the same table without DB changes.
- **Bolding patterns auto-derived from `entityType`/`action`** instead of regex matching the description text.
- **Per-institute retention override** via institute settings, falling back to the global `audit.retention.days`.
- **S3 / cold-storage archival before delete** — required for SOC 2 / ISO 27001 evidence trails.
- **Read-side filter on actor by name/email** instead of raw user-id paste. Backend would need a join to `users` table or a denormalized `actor_name` LIKE index.
- **Compaction** — if volume ever crosses 50M rows, switch to monthly partitioning by `created_at` so retention deletes become `DROP PARTITION` (instant) instead of chunked DELETEs.
