# Performance Transparency Plan — "Is it us or is it your internet?"

**Status:** Phase 0 SHIPPED (`a1b9bfb05`, **corrected** — see §6.5), Phase 1 SHIPPED
(`e5f9f2cb2`). Phases 2–3 not started.
**Surfaces:** admin portal (`frontend-admin-dashboard`), health / super-admin portal (`vacademy-health-check`)

---

## 1. The problem

When a client says "the LMS is slow", we currently cannot tell — from their side or
ours — whether the slowness is:

1. our server work (DB, GC, cold pod, a bad query),
2. their network (school wifi, mobile data, packet loss, distance),
3. their device/browser (a 4GB Chromebook rendering a 500-row table).

Every one of those *feels* identical to the user, so every one of them arrives as
"your product is slow". We answer them by guessing.

Two concrete costs, both real:

- **Support cost.** Each "slow" ticket becomes a manual investigation with no data.
- **Diagnostic cost.** On 2026-08-22 the 18:30 admin_core incident had to be
  reconstructed from container logs that had already rotated — roughly 17 minutes
  of ingress history survived. There was no record of what real users experienced.

## 2. The core idea

The server already knows exactly how long it spent. If it *tells the browser*, the
browser can subtract:

```
network + transfer  ≈  total round trip (browser)  −  server processing time (server)
```

One number crossing the wire turns an unfalsifiable complaint into a decomposition
we can act on, and — critically — one we can show the client.

## 3. What already exists (verified)

We are further along than it looks. Do not rebuild these.

| Asset | Location | State |
|---|---|---|
| Per-request timing filter | `common_service/src/main/java/vacademy/io/common/tracing/RequestTracingFilter.java` | Wraps **every** request at `Ordered.HIGHEST_PRECEDENCE`, times it with `System.nanoTime()`, logs slow/critical, sends Sentry breadcrumbs. **Sets no response headers today.** |
| Tracing toggles | `.../tracing/TracingProperties.java` | Prefix `vacademy.tracing`; `enabled`, `requestFilterEnabled`, `slowRequestThresholdMs=3000`, `criticalRequestThresholdMs=30000`. |
| Slow query logger | `.../tracing/SlowQueryLogger.java` | Already present, 1000ms / 10000ms thresholds. |
| Admin FE HTTP client | `frontend-admin-dashboard/src/lib/auth/axiosInstance.ts` | **Single** axios instance with request + response interceptors already in place — one file to instrument. |
| Admin FE shell | `frontend-admin-dashboard/src/components/common/layout-container/top-navbar.tsx/navbar.tsx` | Where a status pill would mount. |
| Health portal | `vacademy-health-check/` | Vite + React + TanStack Query + Radix. Single axios at `src/lib/axios.ts`; `src/services/*-api.ts` pattern; existing `PulsePage`, `HealthPage` (wraps `components/Dashboard.tsx`), and `StatusAdminPage` (incident CRUD with severity/status — an incident concept already exists to hang alerts off). |
| Redis | prod cluster: `redis-master` + `redis-replica`, ClusterIP, up 84d | Deployed and available. Used from Java today only by `auth_service` and `community_service`. |

**Important scoping fact:** only `admin_core_service` currently wires the
`vacademy.io.common.tracing` package. Every other Spring service (`assessment`,
`notification`, `media`, `auth`, `community`) would need the filter enabled to be
covered. `ai_service` is FastAPI and needs its own middleware.

## 4. The three signals

| Signal | Source | Tells us |
|---|---|---|
| `Server-Timing: app;dur=42` | the existing filter (new header) | our processing time |
| `GET /ping` — few bytes, no DB, no auth | new tiny endpoint | pure network RTT baseline |
| `PerformanceResourceTiming` | browser, already free | DNS, TLS, TTFB, transfer per request |

The `/ping` baseline is the **control**. Server work ≈ 0, so its round trip *is*
their network. Compared against a real call, attribution becomes unambiguous
rather than inferred.

## 5. Classification

| server | network | verdict shown |
|---|---|---|
| high | low | "Vacademy is running slow" — ours |
| low | high | "Your connection is slow" — theirs |
| low | low, UI janky | device / browser |

**Decide on a rolling median of the last ~20 samples, never a single request.**
Otherwise one slow report export flips the badge red and we have shipped a liar.
A badge that cries wolf is worse than no badge, because it trains users to
disbelieve it exactly when it is right.

---

## 6. Phase 0 — emit the header (small, independently useful)

**Goal:** the server tells the truth about its own time. No UI at all.

### 6.1 Set the header in the existing filter

In `RequestTracingFilter.doFilter`, the `finally` block already computes
`durationMs`. Add the header there, before the existing logging calls.

```java
} finally {
    long durationNanos = System.nanoTime() - startTime;
    long durationMs = TimeUnit.NANOSECONDS.toMillis(durationNanos);

    // Tell the browser how much of the round trip was us, so the client can
    // subtract it and attribute the rest to network. Guarded: a committed
    // response (SSE, streamed download) can no longer accept headers.
    if (!httpResponse.isCommitted()) {
        httpResponse.setHeader("Server-Timing", "app;dur=" + durationMs);
        httpResponse.setHeader("Timing-Allow-Origin", "*");
    }
    ...
}
```

Gate it behind a new `TracingProperties` flag (`serverTimingHeaderEnabled`,
default true) so it can be switched off per-service without a code change,
matching the existing toggle style.

### 6.2 Make it readable cross-origin — the trap that will silently break this

The admin portal and `backend-stage.vacademy.io` are **different origins**. Two
separate CORS mechanisms gate this, and both fail *silently* — empty values, no
error in the console:

- **`Timing-Allow-Origin: *`** — required for the value to appear in the Resource
  Timing / `PerformanceServerTiming` API.
- **`Access-Control-Expose-Headers: Server-Timing`** — required to read the header
  off a `fetch`/axios response object.

Every service's `CorsConfig.java` currently reads:

```java
registry.addMapping("/**")
        .allowedOrigins("*")
        .allowedMethods("*")
        .allowedHeaders("*");   // <-- allowedHeaders is REQUEST headers
```

`allowedHeaders("*")` does **not** expose response headers, and Spring does not
wildcard `exposedHeaders`. It must be added explicitly:

```java
        .exposedHeaders("Server-Timing");
```

Files (all six carry the same shape): `admin_core_service`, `assessment_service`,
`notification_service`, `media_service`, `auth_service`, `community_service` →
`.../config/CorsConfig.java`.

For `ai_service`, in `ai_service/app/app_factory.py` (~line 198):

```python
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Server-Timing"],   # add
)
```

Note `allow_credentials=True` is already set there, which means the expose list
**must** be explicit — a wildcard is invalid in a credentialed context.

The ingress does no CORS handling (`vacademy-services-ingress` has no CORS
annotations), so there is nothing to change at that layer.

### 6.3 Why Phase 0 ships alone

With just this, support can ask a client to open DevTools and read one number, and
Chrome renders `Server-Timing` natively in its network panel timing tab. That
alone would have answered the 2026-08-22 complaint. Ship it without waiting for
any dashboard.

### 6.4 Phase 0 as built — verified behaviour

Probed directly against the compiled classes (not asserted from reading code):

| case | Java (`RequestTracingFilter`) | ai_service (`ServerTimingMiddleware`) |
|---|---|---|
| small JSON response | `app;dur=11` ✅ | `app;dur=1` ✅ |
| ~150ms response | `app;dur=124` ✅ (real, not zero) | `app;dur=155` ✅ |
| large / committed response | **absent** — later fixed, see §6.5 | n/a |
| SSE / streaming | **absent** — later fixed, see §6.5 | `app;dur=0` ✅ **and body streams intact** |
| handler threw | still emitted (`finally`) ✅ | — |
| feature flag off / master off | absent ✅ | — |
| CORS preflight | — | unaffected, 200 ✅ |
| resolved `exposedHeaders` | `[Server-Timing]` on all six ✅ | `Access-Control-Expose-Headers: Server-Timing` ✅ |

**Superseded by §6.5** — the asymmetry described here (ai_service covering streaming
while the Java services did not) no longer exists.

**Verified, and worth knowing before touching CORS again:** Spring Security here
does *not* read the `WebMvcConfigurer`. Each service injects a
`CorsConfigurationSource` — but **no such bean is defined anywhere in the
platform**. What actually gets injected is Spring MVC's
`HandlerMappingIntrospector`, which implements `CorsConfigurationSource` and
resolves config from the handler mappings that `addCorsMappings` populates. So
editing `CorsConfig` *does* flow through `.cors()` — confirmed by reading the
resolved `CorsConfiguration` back out of the registry, not by assuming it.

**Deliverable:** header on every admin_core + ai_service response, readable
cross-origin. Files changed: `common_service/.../tracing/{RequestTracingFilter,
TracingProperties}.java`, six `CorsConfig.java`, `ai_service/app/app_factory.py`,
new `ai_service/app/core/server_timing.py`.

### 6.5 Correction: the `finally` block was a silent no-op, and the wrapper was necessary

**What was wrong.** §6.2 documented the coverage gap as "responses larger than
Tomcat's 8KB buffer". That understated it badly. Measured against a real embedded
Tomcat, **every** normal Spring MVC response was already committed by the time the
outermost filter regained control — including a **2-byte `text/plain` body**. Spring's
message converter flushes its output, and that flush commits the response, headers
and all. The Java half of Phase 0 as first shipped emitted the header essentially
never.

**Why the first round of verification missed it.** The probe used
`MockHttpServletResponse`, which does not flush like Tomcat, so an uncommitted
response looked like the normal case. The mock said "works on small responses"; the
real container said "works on nothing". A green probe against the wrong substrate is
not evidence.

It surfaced only because the deployed header was checked against prod, found
missing, and traced with `logging.level.vacademy.io.common.tracing=DEBUG`, which
printed the skip counter's own message: `Server-Timing skipped (response already
committed) for /text`.

**The fix.** `ServerTimingResponseWrapper extends OnCommittedResponseWrapper`
(Spring Security, already a direct `common_service` dependency) stamps the header in
`onResponseCommitted()` — the last moment headers can still be set. This was
deliberately deferred earlier as "materially larger risk than setting a header",
which was the right instinct but weighed against a benefit that turned out to be
zero. Verified against real Tomcat across every response shape:

| endpoint | status | `Server-Timing` | body |
|---|---|---|---|
| `/json` (Jackson) | 200 | `app;dur=29` | intact |
| `/text` (2 bytes) | 200 | `app;dur=1` | intact |
| `/big` (60KB, past the buffer) | 200 | `app;dur=0` | **60000B intact** |
| `/slow` (150ms sleep) | 200 | `app;dur=153` | intact |
| `/sse` (SseEmitter) | 200 | `app;dur=3` | **3 chunks intact** |
| `/stream` (StreamingResponseBody) | 200 | `app;dur=1` | intact |
| `/boom` (handler throws) | 500 | `app;dur=0` | error body |
| `/senderror` | 418 | `app;dur=0` | error body |
| `/redirect` | 302 | `app;dur=0` | — |

`Timing-Allow-Origin` present on all nine. Feature flag and master toggle still
suppress it; a thrown handler still propagates.

**Coverage is now better than the original plan promised:** large responses and SSE
are annotated on the Java services too, so gotcha §10.5 no longer applies. For a
streamed response the figure is time-to-first-byte, which is the right number —
the remainder is transfer, not server work.

---

---

## 7. Phase 1 — client collector + baseline + admin pill

### 7.1 `/ping`

A trivial endpoint: no DB, no auth, no serialization beyond a fixed short body.

- Add to `ALLOWED_PATHS` in
  `admin_core_service/src/main/java/vacademy/io/admin_core_service/core/config/ApplicationSecurityConfig.java`.
- **Naming trap (verified):** `InternalAuthFilter`
  (`common_service/.../auth/filter/InternalAuthFilter.java:27`) 401s **any** URI
  whose path *contains* the substring `internal` unless it carries `clientName` +
  `Signature` headers. This silently killed every assessment_service workflow
  event. Do **not** name any endpoint in this feature `.../internal/...`.
- Must be excluded from its own measurement and from RUM aggregation, or it
  becomes the dominant sample and skews every percentile.

### 7.2 Collector

Instrument the existing response interceptor in
`frontend-admin-dashboard/src/lib/auth/axiosInstance.ts` — a single file, since
all authenticated traffic already flows through one instance.

Per response, record: route template (**not** the raw URL — strip IDs and query
strings, or cardinality explodes and PII leaks into metrics), total ms, `app;dur`
from `Server-Timing`, transfer size, status.

Keep a ring buffer in memory. Compute the verdict from a rolling median.

### 7.3 The pill

Mount in the top navbar. **Silent when healthy** — it appears only on sustained
degradation, and it always names the side. This is where the support saving comes
from: "your connection is slow" ends the argument before it starts.

### 7.4 Phase 1 as built

Files: new `admin_core_service/.../features/perf/controller/PerfPingController.java`
(+ `ALLOWED_PATHS` entry), new `frontend-admin-dashboard/src/lib/perf/network-health.ts`,
new `.../components/common/perf/ConnectionStatusPill.tsx`, instrumented
`.../lib/auth/axiosInstance.ts`, mounted in `.../top-navbar.tsx/navbar.tsx`.

**The network verdict comes from the ping baseline, not from `total - server`.**
That subtraction includes response transfer, so a teacher downloading a 20MB
report over hotel wifi would be reported as "network slow" when their connection
is fine. The ping is a fixed three-byte body, so it is comparable across users and
over time. This is gotcha §10.2 designed out rather than documented.

25 probes pass (pure logic, run against the compiled module). The ones that matter:

| behaviour | result |
|---|---|
| UUID / numeric / email segments templated out of route keys | ✅ no IDs in telemetry |
| 7 very slow samples | stays **silent** (below `MIN_SAMPLES`) |
| one 29s report export among 15 fast calls | stays **healthy** — median, not max |
| unannotated responses (no `Server-Timing`) | counted separately, **not** treated as 0ms |
| sustained 2.8s server time | `server-slow` |
| slow ping, fast server | `network-slow` |
| **both slow** | `server-slow` — never blame the user for our outage |
| failed / offline ping | records nothing, rather than a fake huge number |
| 500s under load | still measured — the indicator must not go blind in an incident |

Verified separately: `JwtAuthFilter` returns immediately without a Bearer token, so
the unauthenticated ping really does skip token parsing and user lookup — the
collector uses a bare `fetch` (no Authorization header, no auth interceptors, no
risk of a background timer tripping the refresh-token or forced-logout path).
The ping is `no-store` *and* cache-busted: a cached ping returns in ~0ms without
touching the network, which would make the baseline silently meaningless.

**Not yet verified in a browser.** The pill's rendered behaviour needs Phase 0's
header and this ping endpoint both live in prod; the logic beneath it is probed,
the pixels are not.

**Deliverable:** admin portal self-diagnoses and says which side.

---

## 8. Phase 2 — aggregate on the health portal

This is the real prize: real-user timings per institute, per endpoint, server vs
network split, over time. One page instead of a forensic log reconstruction.

### 8.1 Ingest — do not let telemetry become the load

We just removed roughly 38% of DB time from admin_core. A row-per-request RUM
table hands it straight back to a 4-core Postgres. Rules:

1. **Aggregate in the browser.** One summary beacon per session per minute via
   `navigator.sendBeacon` (survives page unload; does not block navigation).
2. **Sample sessions**, 5–10%, not requests — so a single user's session stays
   internally consistent and comparable.
3. **Counters in Redis** (already deployed), rolled up periodically into a small
   partitioned table with short retention. Note: admin_core does not currently
   have a Redis client wired — that is real work, and the fallback is per-pod
   in-memory aggregation flushed on a schedule. With 4 admin_core pods, in-memory
   means the rollup must **merge** across pods; percentiles cannot be averaged, so
   store histogram buckets, not pre-computed p95s.
4. **Do not send it to the primary DB path.** Memory: 2026-08-03 an analytics
   query on the primary OOM-killed prod and the unit does not auto-restart.

### 8.2 Surface

Add `src/services/perf-api.ts` following the existing `*-api.ts` convention, and
either extend `PulsePage` or add a sibling page. `StatusAdminPage` already models
incidents with severity/status — Phase 3 alerts should feed that, not a new
concept.

**Deliverable:** per-institute latency with server/network attribution.

---

## 9. Phase 3 — alerting

Alert off the aggregate, into the existing incident model. Only after Phase 2 has
run long enough to establish what normal looks like per endpoint — thresholds
invented before that will be wrong.

---

## 10. Gotchas that matter more than the feature

1. **Per-endpoint thresholds, not a global one.** Course generation and report
   exports are legitimately slow. The existing flat `slowRequestThresholdMs=3000`
   is fine for logging but will cry wolf as a user-facing verdict.
2. **Exclude request/response body transfer from "server slow."** A teacher
   uploading a 200MB PDF on poor wifi is not a slow backend. Resource Timing
   exposes transfer separately — use it.
3. **Suppress during deploys.** Rolling restarts will otherwise paint everything
   red. Memory: startup `initialDelay` is 300s→30s, deploys run 6–10 min.
4. **`navigator.connection` is Chrome/Android only** — no Safari, no Firefox. Use
   it as a hint, never as the basis for a verdict.
5. **Streaming is covered on both stacks** (since §6.5), and the figure is
   time-to-first-byte rather than total duration — correct, since the remainder is
   transfer. Absence of the header still means "could not annotate", never "the
   server was fast", and the filter counts those skips.
6. **Cold-start pods will look "slow"** on their first requests. Either warm them
   or exclude the first N seconds after a pod becomes ready.
7. **Route templating is mandatory** before any metric leaves the browser — raw
   URLs carry IDs (and sometimes emails) and would blow up metric cardinality.
8. **Admin dev builds hit PROD** (memory: admin-test-account). Do not point a RUM
   ingest firehose at prod from a dev loop.

## 11. Open product decision (yours, not mine)

A client-facing indicator cuts both ways. It earns real trust when it correctly
says "your internet is slow" — and it also advertises our bad moments.

A common middle path: **show users only the connection-side warning, and keep
server-side detail internal to the health portal.** Worth deciding before design,
because it changes the UX and the copy.

## 12. Effort sketch

| Phase | Scope | Rough size |
|---|---|---|
| 0 | header + 7 CORS configs + flag | **done** (built + verified, uncommitted) |
| 1 | `/ping` + collector + pill | **done** (built + probed; browser QA pending deploy) |
| 2 | beacon + Redis/rollup + health page | ~3–5 days, the bulk of it ingest, not UI |
| 3 | alerting into existing incidents | ~1 day after Phase 2 has baseline data |

Extending coverage beyond `admin_core_service` (enabling the tracing filter in the
other five Spring services + `ai_service`) is separable and can follow Phase 0.
