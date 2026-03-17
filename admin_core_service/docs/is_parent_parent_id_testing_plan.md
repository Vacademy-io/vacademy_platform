# Testing Plan: is_parent / parent_id on Package Session

Use this document to verify that all 35 APIs work **with** and **without** `is_parent` / `parent_id`, and that responses include the new fields where applicable.

**Prerequisites:**
- Migration `V119__Add_is_parent_and_parent_id_to_package_session.sql` (or V120) applied so `package_session` has `is_parent`, `parent_id`.
- Backend running (e.g. `http://localhost:8072`).
- Valid Bearer token and IDs: `packageId`, `sessionId`, `instituteId`, `courseId` as needed.

**Conventions:**
- `BASE_URL` = `http://localhost:8072` (or your server).
- Replace `YOUR_BEARER_TOKEN` with a valid JWT.
- Replace placeholder IDs (`1`, `INVITED`, `3e535c8e-5566-43b9-8297-7418c4f38feb`, etc.) with real values from your environment.

---

## 1. Request APIs (6) – Test with and without is_parent / parent_id

These APIs **create or update** batches. Test **both**:
- **With** `is_parent` / `parent_id` in the body (parent/child batches).
- **Without** (omit both fields or send `null`) to confirm backward compatibility.

---

### 1.1 Add Level (creates one package_session/batch)

**Endpoint:** `POST /admin-core-service/level/v1/add-level`

**Test A – With is_parent (parent batch):**

```bash
curl --location 'http://localhost:8072/admin-core-service/level/v1/add-level?packageId=1&sessionId=INVITED&instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "id": null,
  "new_level": true,
  "level_name": "Parent Batch Level",
  "duration_in_days": 30,
  "thumbnail_file_id": null,
  "group": null,
  "add_faculty_to_course": [],
  "is_parent": true,
  "parent_id": null
}'
```

**Expected response:** `200 OK`, body e.g. success message string (e.g. level/batch created). No error.

**Test B – With parent_id (child batch):**  
First create a parent with Test A and note the created package_session/batch ID. Then:

```bash
curl --location 'http://localhost:8072/admin-core-service/level/v1/add-level?packageId=1&sessionId=INVITED&instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "id": null,
  "new_level": true,
  "level_name": "Child Batch Level",
  "duration_in_days": 30,
  "thumbnail_file_id": null,
  "group": null,
  "add_faculty_to_course": [],
  "is_parent": false,
  "parent_id": "PARENT_PACKAGE_SESSION_ID_HERE"
}'
```

**Expected response:** `200 OK`, success. Batch created with `parent_id` set.

**Test C – Without is_parent / parent_id (backward compatible):**

```bash
curl --location 'http://localhost:8072/admin-core-service/level/v1/add-level?packageId=1&sessionId=INVITED&instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "id": null,
  "new_level": true,
  "level_name": "Beginner Level",
  "duration_in_days": 30,
  "thumbnail_file_id": null,
  "group": null,
  "add_faculty_to_course": []
}'
```

**Expected response:** `200 OK`. Batch created with `is_parent` = false, `parent_id` = null (defaults).

---

### 1.2 Add Session (creates batches per level)

**Endpoint:** `POST /admin-core-service/sessions/v1/add`

**Test A – With is_parent / parent_id in levels:**

```bash
curl --location 'http://localhost:8072/admin-core-service/sessions/v1/add?instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "id": null,
  "session_name": "2026-27",
  "status": "ACTIVE",
  "start_date": "2026-04-01T00:00:00.000Z",
  "new_session": true,
  "levels": [
    {
      "id": null,
      "new_level": true,
      "level_name": "Parent Level",
      "duration_in_days": 30,
      "thumbnail_file_id": null,
      "package_id": "YOUR_PACKAGE_ID",
      "group": null,
      "status": "ACTIVE",
      "package_session_status": "ACTIVE",
      "package_session_id": null,
      "new_package_session": true,
      "add_faculty_to_course": [],
      "is_parent": true,
      "parent_id": null
    }
  ]
}'
```

**Expected response:** `200 OK`, e.g. "Session created successfully with ID: ...".

**Test B – Without is_parent / parent_id:** Omit `is_parent` and `parent_id` from each object in `levels[]`. **Expected:** Same success; batches created with defaults.

---

### 1.3 Add Course

**Endpoint:** `POST /admin-core-service/course/v1/add-course/{instituteId}`

**Test A – With is_parent / parent_id in sessions[].levels[]:**

Body shape: `AddCourseDTO` → `sessions[]` (AddNewSessionDTO) → `levels[]` (AddLevelWithSessionDTO). Add per level:

```json
"is_parent": true,
"parent_id": null
```
or for a child:
```json
"is_parent": false,
"parent_id": "PARENT_PACKAGE_SESSION_ID"
```

**Test B – Without:** Omit both from every level. **Expected:** Course and batches created; no errors.

**Example (minimal) curl:**

```bash
curl --location 'http://localhost:8072/admin-core-service/course/v1/add-course/3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "id": null,
  "new_course": true,
  "course_name": "Test Course",
  "thumbnail_file_id": null,
  "contain_levels": true,
  "sessions": [
    {
      "id": null,
      "session_name": "2026-27",
      "status": "ACTIVE",
      "start_date": "2026-04-01T00:00:00.000Z",
      "new_session": true,
      "levels": [
        {
          "id": null,
          "new_level": true,
          "level_name": "Level A",
          "duration_in_days": 30,
          "thumbnail_file_id": null,
          "package_id": "YOUR_PACKAGE_ID",
          "group": null,
          "status": "ACTIVE",
          "package_session_status": "ACTIVE",
          "package_session_id": null,
          "new_package_session": true,
          "add_faculty_to_course": [],
          "is_parent": true,
          "parent_id": null
        }
      ]
    }
  ],
  "is_course_published_to_catalaouge": false,
  "course_depth": 2,
  "tags": []
}'
```

**Expected response:** `200 OK`, course/batch creation success.

---

### 1.4 Bulk Add Courses

**Endpoint:** `POST /admin-core-service/course/v1/bulk-add-courses/{instituteId}`

**Test A – With is_parent / parent_id in batches:**  
In `BulkAddCourseRequestDTO.courses[].batches[]` or `applyToAll.batches[]`, each `BulkCourseBatchDTO` can have:

```json
"is_parent": true,
"parent_id": null
```
or
```json
"is_parent": false,
"parent_id": "PARENT_PACKAGE_SESSION_ID"
```

**Test B – Without:** Omit both in all batch objects. **Expected:** Bulk create succeeds; batches get default is_parent/parent_id.

**Example (minimal):**

```bash
curl --location 'http://localhost:8072/admin-core-service/course/v1/bulk-add-courses/3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "courses": [
    {
      "course_name": "Bulk Course 1",
      "batches": [
        {
          "level_id": "YOUR_LEVEL_ID",
          "session_id": "YOUR_SESSION_ID",
          "is_parent": true,
          "parent_id": null
        }
      ]
    }
  ]
}'
```

**Expected response:** `200 OK`, `BulkAddCourseResponseDTO` with created course/batch info.

---

### 1.5 Update Course Details

**Endpoint:** `POST /admin-core-service/course/v1/update-course-details/{instituteId}`

Same body shape as Add Course. **Test A:** Include `is_parent` / `parent_id` in `sessions[].levels[]`. **Test B:** Omit both. **Expected:** Update succeeds; existing behaviour unchanged when omitted.

```bash
curl --location 'http://localhost:8072/admin-core-service/course/v1/update-course-details/3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "id": "EXISTING_COURSE_ID",
  "new_course": false,
  "course_name": "Updated Course",
  "sessions": [ ... ],
  "is_course_published_to_catalaouge": false,
  "course_depth": 2,
  "tags": []
}'
```

---

### 1.6 Teacher Add Course

**Endpoint:** `POST /admin-core-service/course/teacher/v1/add-course/{instituteId}`

Same as Add Course: `AddCourseDTO` with `sessions[].levels[]`. **Test A:** Add `is_parent` / `parent_id` per level. **Test B:** Omit. **Expected:** Same as add-course.

```bash
curl --location 'http://localhost:8072/admin-core-service/course/teacher/v1/add-course/3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{ ... same shape as add-course ... }'
```

---

## 2. Response APIs (29) – Verify is_parent / parent_id in response

For each endpoint below, call the API and assert that batch/package-session objects in the response include `is_parent` (boolean) and `parent_id` (string or null). Existing rows may have `is_parent: false`, `parent_id: null`.

---

### 2.1 Get batches for course

```bash
curl --location 'http://localhost:8072/admin-core-service/course/v1/COURSE_ID/batches' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** List of `CourseBatchDTO`. Each object must have `is_parent`, `parent_id`. Example snippet:

```json
[
  {
    "id": "...",
    "packageId": "...",
    "levelId": "...",
    "sessionId": "...",
    "is_parent": false,
    "parent_id": null,
    ...
  }
]
```

---

### 2.2 Paginated batches

```bash
curl --location 'http://localhost:8072/admin-core-service/institute/v1/paginated-batches/3e535c8e-5566-43b9-8297-7418c4f38feb?page=0&size=20' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** `PaginatedPackageSessionResponse` with list of `PackageSessionDTO`; each has `is_parent`, `parent_id`.

---

### 2.3 Batches by IDs

```bash
curl --location 'http://localhost:8072/admin-core-service/institute/v1/batches-by-ids/3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{"ids": ["PACKAGE_SESSION_ID_1", "PACKAGE_SESSION_ID_2"]}'
```

**Expected:** `BatchLookupResponse` with batches; each batch has `is_parent`, `parent_id`.

---

### 2.4 Institute details

```bash
curl --location 'http://localhost:8072/admin-core-service/institute/v1/details/3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** `InstituteInfoDTO`; `batchesForSessions` (or equivalent) contains batch objects with `is_parent`, `parent_id`.

---

### 2.5 Institute setup

```bash
curl --location 'http://localhost:8072/admin-core-service/institute/v1/setup/3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** `InstituteInfoDTOForTableSetup`; batch list includes `is_parent`, `parent_id`.

---

### 2.6 Learner batches

```bash
curl --location 'http://localhost:8072/admin-core-service/institute/learner-batch/v1/3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** List of learner batch objects with `is_parent`, `parent_id`.

---

### 2.7 Batches by session (BatchController)

```bash
curl --location 'http://localhost:8072/admin-core-service/batch/v1/batches-by-session?sessionId=INVITED&instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** List of package/batch details; batch projections include `is_parent`, `parent_id`.

---

### 2.8 Batch search

```bash
curl --location 'http://localhost:8072/admin-core-service/batch/v1/search?page=0&size=20' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "institute_id": "3e535c8e-5566-43b9-8297-7418c4f38feb",
  "status": ["ACTIVE"],
  "level_ids": [],
  "tags": [],
  "search_by_name": null
}'
```

**Expected:** Page of `PackageDTOWithBatchDetails`; batch data has `is_parent`, `parent_id`.

---

### 2.9 Batches by session (Catalogue)

```bash
curl --location 'http://localhost:8072/admin-core-service/catalouge-batch/v1/batches-by-session?sessionId=INVITED&instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** Batch list with `is_parent`, `parent_id`.

---

### 2.10 Package search

```bash
curl --location 'http://localhost:8072/admin-core-service/packages/v1/search?instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb&page=0&size=20' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{}'
```

**Expected:** Page of `PackageDetailDTO`; `packageSessions` (or batch array) has `is_parent`, `parent_id`.

---

### 2.11 Package detail by ID

```bash
curl --location 'http://localhost:8072/admin-core-service/packages/v1/package-detail?packageId=YOUR_PACKAGE_ID' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** `PackageDetailDTO`; batch data includes `is_parent`, `parent_id`.

---

### 2.12 Package filter

```bash
curl --location 'http://localhost:8072/admin-core-service/packages/v1/filter' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '["PACKAGE_SESSION_ID_1", "PACKAGE_SESSION_ID_2"]'
```

**Expected:** `PackageFilterDetailsDTO`; batches for session include `is_parent`, `parent_id`.

---

### 2.13 Learner packages search

```bash
curl --location 'http://localhost:8072/admin-core-service/learner-packages/v1/search?instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb&page=0&size=20' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{}'
```

**Expected:** Page of `PackageDetailDTO`; batch data has `is_parent`, `parent_id`.

---

### 2.14 Learner packages by user ID

```bash
curl --location 'http://localhost:8072/admin-core-service/learner-packages/v1/search-by-user-id?page=0&size=20' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{"user_id": "USER_ID", "institute_id": "3e535c8e-5566-43b9-8297-7418c4f38feb"}'
```

**Expected:** Same; batch objects include `is_parent`, `parent_id`.

---

### 2.15 Learner package detail

```bash
curl --location 'http://localhost:8072/admin-core-service/learner-packages/v1/package-detail?packageId=YOUR_PACKAGE_ID' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** `PackageDetailDTO` with batch fields `is_parent`, `parent_id`.

---

### 2.16 Open package search v1

```bash
curl --location 'http://localhost:8072/admin-core-service/open/packages/v1/search?instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb&page=0&size=20' \
--header 'Content-Type: application/json' \
--data '{}'
```

**Expected:** Package list; batch data has `is_parent`, `parent_id`.

---

### 2.17 Open package detail

```bash
curl --location 'http://localhost:8072/admin-core-service/open/packages/v1/package-detail?packageId=YOUR_PACKAGE_ID'
```

**Expected:** `PackageDetailDTO`; batch data includes `is_parent`, `parent_id`.

---

### 2.18 Open package search v2

```bash
curl --location 'http://localhost:8072/admin-core-service/open/packages/v2/search?instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb&page=0&size=20' \
--header 'Content-Type: application/json' \
--data '{}'
```

**Expected:** `PackageDetailV2DTO`; batch data has `is_parent`, `parent_id`.

---

### 2.19 Update batch capacity

```bash
curl --location --request PUT 'http://localhost:8072/admin-core-service/package-session/PACKAGE_SESSION_ID/inventory/update-capacity' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{"max_seats": 50}'
```

**Expected:** Returns batch/package-session (e.g. `PackageSession`); response includes `is_parent`, `parent_id`.

---

### 2.20 Session details

```bash
curl --location 'http://localhost:8072/admin-core-service/sessions/v1/session-details?instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** List of session details; level/batch data (`LevelDTOWithPackageSession`) has `is_parent`, `parent_id`.

---

### 2.21 Applicant list

```bash
curl --location 'http://localhost:8072/admin-core-service/v1/applicant/list?pageNo=0&pageSize=10' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "institute_id": "3e535c8e-5566-43b9-8297-7418c4f38feb",
  "source": "INSTITUTE",
  "source_id": "3e535c8e-5566-43b9-8297-7418c4f38feb",
  "package_session_ids": [],
  "overall_statuses": [],
  "search": null
}'
```

**Expected:** Page of `ApplicantListResponseDTO`; `PackageSessionData` (or batch info) has `is_parent`, `parent_id`.

---

### 2.22 Public institute details

```bash
curl --location 'http://localhost:8072/admin-core-service/public/institute/v1/details/3e535c8e-5566-43b9-8297-7418c4f38feb'
```

**Expected:** Institute details; batches include `is_parent`, `parent_id`.

---

### 2.23 Learner institute details

```bash
curl --location 'http://localhost:8072/admin-core-service/learner/v1/details/3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** `StudentInstituteInfoDTO`; `batchesForSessions` has `is_parent`, `parent_id`.

---

### 2.24 Learner institute details by IDs

```bash
curl --location 'http://localhost:8072/admin-core-service/learner/v1/details/by-ids?instituteIds=3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** Same; batch list includes `is_parent`, `parent_id`.

---

### 2.25 Study library init

```bash
curl --location 'http://localhost:8072/admin-core-service/v1/study-library/init?instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** `CourseDTOWithDetails`; `packageSessions` has `is_parent`, `parent_id`.

---

### 2.26 Study library course-init

```bash
curl --location 'http://localhost:8072/admin-core-service/v1/study-library/course-init?courseId=COURSE_ID&instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** Course details; packageSessions include `is_parent`, `parent_id`.

---

### 2.27 Open learner study library init

```bash
curl --location 'http://localhost:8072/admin-core-service/open/v1/learner-study-library/init?instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** Same; packageSessions have `is_parent`, `parent_id`.

---

### 2.28 Open learner study library course-init

```bash
curl --location 'http://localhost:8072/admin-core-service/open/v1/learner-study-library/course-init?courseId=COURSE_ID&instituteId=3e535c8e-5566-43b9-8297-7418c4f38feb' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN'
```

**Expected:** Same; batch data includes `is_parent`, `parent_id`.

---

### 2.29 Membership details

```bash
curl --location 'http://localhost:8072/admin-core-service/v1/user-plan/membership-details?pageNo=0&pageSize=10' \
--header 'Authorization: Bearer YOUR_BEARER_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "institute_id": "3e535c8e-5566-43b9-8297-7418c4f38feb",
  "user_id": null,
  "statuses": []
}'
```

**Expected:** Page of `MembershipDetailsDTO`; each membership’s batch list (`PackageSessionLiteDTO`) has `is_parent`, `parent_id`.

---

## 3. Summary checklist

| Category | Count | What to verify |
|----------|-------|----------------|
| Request (create/update) | 6 | Call with `is_parent`/`parent_id` and without; both succeed. |
| Response (read) | 29 | Each response includes `is_parent` and `parent_id` on batch/package-session objects. |
| **Total** | **35** | |

**Backward compatibility:** For all 6 request APIs, sending no `is_parent`/`parent_id` (or `null`) must behave as before: batches created with `is_parent` = false, `parent_id` = null. No existing client should break after deployment.
