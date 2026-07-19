# Parent Portal — "My Child" Monitoring

A guardian-facing section of the learner app where a parent monitors an **enrolled
child**: progress, attendance, tests, live classes, fees, and rewards. Built for
non-technical parents — plain-language summaries first, a friendly card home, a
quick-search, a preset-question chatbot, and a guided tour.

> **Naming.** The data model says **parent** (`is_parent`, `linked_parent_id`,
> `PARENT_SETTING`); user-facing strings say **guardian/parent**. Same thing.
> See [`GUARDIAN_PARENT_CHILD_ARCHITECTURE.md`](./GUARDIAN_PARENT_CHILD_ARCHITECTURE.md)
> for how a guardian is linked to a child.

---

## 1. Why a BFF instead of reusing learner endpoints

The learner endpoints that accept an explicit `userId` (attendance, invoices,
live sessions, progress, badges) **never check it against the caller** — they are
live IDORs. Building the portal directly on them would make its security "the
frontend only sends the right id".

So the portal is a **new authenticated Backend-For-Frontend** in `admin_core_service`
with a single **guardian-link guard**. That guard is also the pattern that would
fix those IDORs (a staged retrofit, tracked separately — not done here).

**Design rule #0 — access is decided by the token, never the request.** The
guardian id comes from the JWT; the institute from the `clientId` header. There is
**no `parentUserId` parameter anywhere** — a parent literally cannot express
"show me someone else's child".

---

## 2. Backend (`admin_core_service`)

### 2.1 The guard — `core/security/`

| Class | Role |
|---|---|
| `GuardianAccessGuard` | The spine. `requireLinkedChild(caller, childUserId)` → `GuardedChild` or throws. `isLinkedChild(...)` is the boolean sibling for `canAccess`. `listGuardianChildren(caller)` for the picker. |
| `GuardedChild` (record) | `(childUserId, instituteId, packageSessionIds, fullName)`. Every `ParentPortal*Service` method takes this, never a bare `String childUserId` — so no data path is reachable unguarded (enforced by the type system). |
| `GuardianLinkCacheService` | Caches the authoritative `auth_service` guardian→children lookup (`guardianChildren`, 60s, positive results only). |

**`requireLinkedChild` legs (deny-by-default):**
1. Preconditions (caller/child non-blank).
2. **Tenant** — institute from `clientId` header; `InstituteAccessValidator`.
3. **Self** — a learner reading their own data passes through.
4. **Role** — caller must hold `PARENT` (defence in depth).
5. **Link** — authoritative via `auth_service` (`getChildrenOfParent`). Unreachable ⇒ **503, not 403**; failures never cached.
6. **Enrolment** — the child must have a non-terminal enrolment in *this* institute (`findEnrolledPackageSessionIds`, case-insensitive, excludes `DELETED/TERMINATED/EXPIRED`).

> ⚠️ The guard resolves the link from **`auth_service`**, never the local
> `student.guardian_user_id` mirror — that mirror can be *affirmatively wrong* in
> the permissive direction. Do not "optimise" the HMAC call away.

### 2.2 The BFF — `features/parent_portal/`

Base path `/admin-core-service/parent-portal/v1` (authenticated; **not** in
`ALLOWED_PATHS`). Every `{childUserId}` handler's first act is the guard.

| Method | Path | Returns |
|---|---|---|
| GET | `/children` | `ParentChildSummaryDTO[]` — enrolled children in the clientId institute (child-picker) |
| GET | `/settings` | `ParentPortalSettingsDTO` |
| GET | `/children/{id}/overview` | `ChildOverviewDTO` — counts + headline numbers (fault-isolated) |
| GET | `/children/{id}/attendance` | `StudentAttendanceReportDTO` |
| GET | `/children/{id}/live-sessions/{upcoming,past}` | grouped sessions |
| GET | `/children/{id}/progress/subjects` | subject-wise progress |
| GET | `/children/{id}/assessments` | assessment history |
| GET | `/children/{id}/payments/invoices` | `InvoiceDTO[]` |
| GET | `/children/{id}/badges` | `LearnerBadgeDTO[]` |
| GET | `/children/{id}/certificates` | `IssuedCertificateDTO[]` |
| GET | `/children/{id}/reports` | report list (metadata) |

**Two rules that prevent the worst bugs:**
- **Sub-resource ownership** — the guard proves parent→child, not invoice→child.
  Each `{invoiceId}`/`{processId}` handler re-verifies `resource.userId == child`.
- **Unavailability ≠ zero** — the overview fan-out is per-module fault-isolated
  into `unavailableModules`; a failed collector leaves its number **null**, never a
  wrong `0` (a "0% attendance" from a thrown query is a false accusation).

**Delegating to existing services in-process** (never re-calling JWT-bound
controllers): `AttendanceReportService`, `GetLiveSessionService`,
`LearnerReportService`, `InvoiceService`, `LearnerBadgeService`,
`AssessmentServiceClient`, `LearnerInstituteManager`, `StudentAnalysisProcessRepository`.

### 2.3 Report access — `canAccess()`

`StudentAnalysisController.canAccess()` gained a **guardian-link OR-leg**: a parent
may read a report whose subject is their *own linked child*. Owner/staff still
short-circuit first, so existing access is unchanged.

### 2.4 Certificate read path — `features/certificate/`

Previously certificates were only reachable via the v2 report collector. Added:
repo finders (incl. the ownership check), an IP-safe `IssuedCertificateDTO` (omits
`templateHtmlSnapshot`), `CertificateReadService`, and `LearnerCertificateController`
(`/admin-core-service/certificate/learner/v1/my-certificates`).

---

## 3. Enabling the portal — `PARENT_SETTING.parentPortal`

Institute-scoped, **off by default**. Read server-side by `ParentPortalSettingService`
(module visibility is an **authorization boundary**, not just a UI hint).

```json
"PARENT_SETTING": { "data": { "parentPortal": {
  "enabled": true,
  "modules": {
    "overview": {"visible": true}, "attendance": {"visible": true},
    "liveSessions": {"visible": true}, "assessments": {"visible": true},
    "progress": {"visible": true}, "payments": {"visible": false},
    "badges": {"visible": true}, "certificates": {"visible": true},
    "reports": {"visible": true}
  }
}}}
```

- This is **separate** from the guardian-linking `enabled` flag. `payments`
  defaults off (most sensitive).
- Admin UI: **Settings → Guardian Setting → Parent Portal** card (enable + per-module
  toggles). Or `POST /admin-core-service/institute/setting/v1/save-setting?instituteId=&settingKey=PARENT_SETTING`
  with the full `setting_data` object.
- Settings cache 2 min per institute; a fresh enable takes up to 2 min (or restart).

---

## 4. Frontend (`frontend-learner-dashboard-app`)

Section under `src/routes/parent/child/**` (the existing admissions `/parent` is
untouched). Design-system compliant; the `/parent/child` guard denylist fix in
`__root.tsx` is a **separate TODO** — the 3-segment routes are already private, and
data is guarded server-side.

**Login routing** (`src/lib/auth/detect-user-role.ts`): a **PARENT-only** guardian
is hydrated (they have no `student` row) and routed to `/parent/child`; a dual-role
(STUDENT+PARENT) user is **not** force-routed — they keep their learner dashboard.

| Area | Files |
|---|---|
| Data | `-services/parent-portal-api.ts`, `-hooks/use-parent-child.ts` (`parentPortalQueryKeys`), `-types/parent-child.ts`, endpoints in `constants/urls.ts` |
| Shell | `ParentChildShell` (resolves child from `childId`; profile menu = parent identity + **switch child** + logout; **help** button), `ParentProfileMenu` |
| Home | `$childId/index.tsx` — greeting → search → **card grid** → attention → stats. `ParentQuickSearch` (type "at" → Attendance), `AttentionCard`, `ParentStatusChip` |
| Modules | six screens + `ModuleScaffold`; report detail reuses `StudentReportCard` |
| Extras | `ParentChatbot` (preset Q&A answered from `/overview` — safe, no AI backend), `ParentHelpButton` + `-lib/parent-tour.ts` (driver.js), `ParentModuleIcon` (generated → `cleaner-play` → Phosphor) |
| i18n | `src/locales/{en,hi,ar}/parent.json` (hi/ar currently mirror en) |

**Look & feel:** white cards + soft shadows (no hard borders), warm tinted icon
containers, generous spacing — inspired by cuepilot.ai/showcase/parent's design
*language* (not a pixel clone; that's a different product — a daycare app).

### Icons
`scripts/generate-parent-icons.mjs` (OpenRouter `google/gemini-3.1-flash-image`)
fills the one missing icon (payments). Five of six already exist in
`src/assets/cleaner-play/`. Only committed `.webp` (raw PNGs gitignored).

---

## 5. Testing

1. `PARENT` role must exist in `auth_service` (prod ✅; fresh DB needs a seed).
2. A guardian (PARENT role) whose child has a **non-terminal** enrolment.
3. Enable `parentPortal.enabled` for the institute (§3).
4. Log in as the guardian → `/parent/child` → picker → tile home → each module.
5. **Security:** a non-linked `childUserId` → **403** + an audit `Guardian access DENIED` log. Portal off / module hidden / wrong institute → 403.

---

## 6. Known follow-ups (not in this feature)

- `__root.tsx` `isPublicRoute` denylist still says `/parent-portal` (dead) — the
  2-segment `/parent/*` routes are public; harmless (data is server-guarded) but
  should be tightened.
- The IDOR retrofit on the underlying learner endpoints (staged).
- `V15` seed for the `PARENT` role; repair for legacy role-less guardians.
- hi/ar real translations (currently English placeholders).
- Read-aloud / voice; a date-grouped activity feed.
- The `/overview` headline numbers (attendance %, tests, upcoming) require the
  enrichment in `ParentPortalOverviewService` to be deployed.
