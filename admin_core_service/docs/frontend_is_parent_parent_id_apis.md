# Frontend: All 35 APIs for `is_parent` and `parent_id`

Backend has added `is_parent` (boolean) and `parent_id` (optional string) to batch/package-session flows. This document lists **all 35 APIs** the frontend needs to consider.

**Base path:** Prepend your API base URL. Backend context path is `admin-core-service`.

**Backward compatibility:** Both fields are **optional**. Existing payloads that do not send `is_parent` or `parent_id` continue to work; backend defaults `is_parent` to `false` and `parent_id` to `null`.

---

## 1. Change REQUEST payload (6 APIs)

For these **6** APIs, the frontend should **send** `is_parent` and `parent_id` in the request body when creating or updating batches (so parent/child relationships are stored correctly).

**Payload field names and types (use snake_case in JSON):**

| Field        | Type    | Required | Description |
|-------------|---------|----------|-------------|
| `is_parent` | boolean | No       | `true` if this batch is a parent batch; omit or `false` otherwise. |
| `parent_id` | string  | No       | ID of the parent batch if this is a child batch; omit or `null` if not a child. |

| # | Method | Full path | Where to add in payload |
|---|--------|-----------|-------------------------|
| 1 | POST | `admin-core-service/level/v1/add-level` | In the level/batch object (AddLevelWithCourseDTO). |
| 2 | POST | `admin-core-service/sessions/v1/add` | In each level's batch object (AddLevelWithSessionDTO inside `levels[]` of AddNewSessionDTO). |
| 3 | POST | `admin-core-service/course/v1/add-course/{instituteId}` | In course → sessions → levels batch data (AddLevelWithSessionDTO). |
| 4 | POST | `admin-core-service/course/v1/bulk-add-courses/{instituteId}` | In each batch item in `batches` (BulkCourseBatchDTO). |
| 5 | POST | `admin-core-service/course/v1/update-course-details/{instituteId}` | In course/session/level batch data (same shape as add course). |
| 6 | POST | `admin-core-service/course/teacher/v1/add-course/{instituteId}` | In course → sessions → levels batch data (AddCourseDTO). |

---

## 2. Handle RESPONSE (29 APIs)

For these **29** APIs, the backend **returns** `is_parent` (boolean) and `parent_id` (string or null) on batch/package-session objects. Frontend should **read and use** these fields (e.g. display, filter, or group by parent/child) wherever these endpoints are called. Response uses **snake_case** (`is_parent`, `parent_id`).

| # | Method | Full path | Response location of batch fields |
|---|--------|-----------|-----------------------------------|
| 7 | GET | `admin-core-service/course/v1/{courseId}/batches` | CourseBatchDTO list |
| 8 | GET | `admin-core-service/institute/v1/paginated-batches/{instituteId}` | PackageSessionDTO list |
| 9 | POST | `admin-core-service/institute/v1/batches-by-ids/{instituteId}` | PackageSessionDTO list |
| 10 | GET | `admin-core-service/institute/v1/details/{instituteId}` | InstituteInfoDTO.batchesForSessions |
| 11 | GET | `admin-core-service/institute/v1/setup/{instituteId}` | InstituteInfoDTOForTableSetup.batchesForSessions |
| 12 | GET | `admin-core-service/institute/learner-batch/v1/{instituteId}` | LearnerBatchProjection list |
| 13 | GET | `admin-core-service/batch/v1/batches-by-session` | BatchProjection list |
| 14 | POST | `admin-core-service/batch/v1/search` | PackageDTOWithBatchDetails (BatchProjection) |
| 15 | GET | `admin-core-service/catalouge-batch/v1/batches-by-session` | BatchProjection |
| 16 | POST | `admin-core-service/packages/v1/search` | PackageDetailDTO.packageSessions |
| 17 | GET | `admin-core-service/packages/v1/package-detail` | PackageDetailDTO (batch data) |
| 18 | POST | `admin-core-service/packages/v1/filter` | batchesForSession (PackageSessionDTO) |
| 19 | POST | `admin-core-service/learner-packages/v1/search` | PackageDetailDTO (batch data) |
| 20 | POST | `admin-core-service/learner-packages/v1/search-by-user-id` | PackageDetailDTO (batch data) |
| 21 | GET | `admin-core-service/learner-packages/v1/package-detail` | PackageDetailDTO (batch data) |
| 22 | POST | `admin-core-service/open/packages/v1/search` | PackageDetailDTO (batch data) |
| 23 | GET | `admin-core-service/open/packages/v1/package-detail` | PackageDetailDTO (batch data) |
| 24 | POST | `admin-core-service/open/packages/v2/search` | PackageDetailV2DTO (batch data) |
| 25 | PUT | `admin-core-service/package-session/{packageSessionId}/inventory/update-capacity` | Response batch shape (if returned) |
| 26 | GET | `admin-core-service/sessions/v1/session-details` | LevelDTOWithPackageSession (batch data) |
| 27 | POST | `admin-core-service/v1/applicant/list` | ApplicantListResponseDTO.PackageSessionData |
| 28 | GET | `admin-core-service/public/institute/v1/details/{instituteId}` | InstituteInfoDTO.batchesForSessions |
| 29 | GET | `admin-core-service/learner/v1/details/{instituteId}` | StudentInstituteInfoDTO.batchesForSessions |
| 30 | GET | `admin-core-service/learner/v1/details/by-ids` | StudentInstituteInfoDTO.batchesForSessions |
| 31 | GET | `admin-core-service/v1/study-library/init` | CourseDTOWithDetails.packageSessions |
| 32 | GET | `admin-core-service/v1/study-library/course-init` | CourseDTOWithDetails.packageSessions |
| 33 | GET | `admin-core-service/open/v1/learner-study-library/init` | CourseDTOWithDetails.packageSessions |
| 34 | GET | `admin-core-service/open/v1/learner-study-library/course-init` | CourseDTOWithDetails.packageSessions |
| 35 | POST | `admin-core-service/v1/user-plan/membership-details` | MembershipDetailsDTO → List of PackageSessionLiteDTO |

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| Request payload | 6 | Send `is_parent`, `parent_id` in body where creating/updating batches. |
| Response | 29 | Read `is_parent`, `parent_id` from batch/package-session objects and use in UI (e.g. parent/child grouping). |
| **Total** | **35** | |

Source: [is_parent_parent_id_apis_fbfe8484.plan.md](.cursor/plans/is_parent_parent_id_apis_fbfe8484.plan.md)
