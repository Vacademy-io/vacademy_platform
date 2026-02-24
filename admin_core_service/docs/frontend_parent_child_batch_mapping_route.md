# Frontend + Backend Requirement: Parent/Child Batch Mapping Route

This doc describes a **new frontend route** to map **child batches** (package sessions) under a **parent batch**, and the **backend API** needed to persist it.

## Goal

Allow institute admins to reduce “too many levels” by using `package_session` hierarchy:

- **Parent batch**: `is_parent = true`, `parent_id = null`
- **Child batch**: `parent_id = <parent_package_session_id>` (and typically `is_parent = false` or null/false)

Example:
- Parent dropdown: **Class 10**
- Child multiselect: **10A, 10B, 10C**

---

## Frontend (Admin UI)

### New route

Create one new route/page (name as per your app convention), e.g.:
- **Route**: `/admin/batch-parent-child-mapping` (example)

### UI requirements

- **Dropdown #1: Parent batch (single select)**
  - Label: “Select parent batch”
  - Selection type: **single select**
  - Value: `parentPackageSessionId`
  - Display label suggestion: `packageName + " - " + levelName + " - " + sessionName`

- **Dropdown #2: Child batches (multi select)**
  - Label: “Select child batches”
  - Selection type: **multi select**
  - Value: `childPackageSessionIds[]`
  - Should exclude:
    - the selected parent itself
    - (optional) children already attached to a different parent unless you allow re-parenting

- **Submit button**
  - Label: “Save mapping”
  - On click: call backend API described below.

### Data fetching (to populate dropdowns)

You can use existing batch listing APIs to populate both dropdowns (any of these that your admin frontend already uses):
- `GET admin-core-service/institute/v1/paginated-batches/{instituteId}`
- OR `GET admin-core-service/sessions/v1/session-details?instituteId=...`
- OR any existing “batches list” API in your frontend.

The dropdown options must read these fields from batch objects:
- `id`
- `is_parent`
- `parent_id`

---

## Backend (Admin Core Service)

### New API to implement

Implement **one API** that:
1. Marks the selected parent batch as `is_parent = true` (ensures parent flag)
2. Traverses each selected child batch and sets `parent_id = parentPackageSessionId`

#### Suggested endpoint

- **Method**: `PUT`
- **Path**: `/admin-core-service/package-session/v1/parent-child-mapping`

#### Request (JSON)

```json
{
  "institute_id": "INSTITUTE_ID",
  "parent_package_session_id": "PARENT_PACKAGE_SESSION_ID",
  "child_package_session_ids": ["CHILD_1", "CHILD_2", "CHILD_3"]
}
```

Notes:
- `parent_package_session_id`: **single id**
- `child_package_session_ids`: **array** (multi-select)

#### Response (JSON)

Return something explicit for frontend:

```json
{
  "parent_package_session_id": "PARENT_PACKAGE_SESSION_ID",
  "updated_child_count": 3,
  "updated_child_package_session_ids": ["CHILD_1", "CHILD_2", "CHILD_3"]
}
```

### Backend rules (expected behavior)

- **Parent update**
  - Set `is_parent = true` for the parent batch row.
  - Keep `parent_id` for the parent as `null` (do not make parent a child).

- **Child updates**
  - For each `child_id`:
    - Set `parent_id = parent_package_session_id`
    - (Optional) Force `is_parent = false` if you want strictness, but do not require this for backward compatibility.

- **Validation**
  - Parent and all children must exist.
  - Parent must belong to the same `institute_id` context as children (based on your existing institute ownership logic).
  - A child should not equal the parent.

- **Re-parenting behavior (decide policy)**
  - Option A (recommended): allow re-parenting by overwriting `parent_id`
  - Option B: reject if child already has a `parent_id` different from this parent

---

## Frontend payload summary (important)

- **Parent batch dropdown**: **single select** → sends `parent_package_session_id`
- **Child batch dropdown**: **multi select** → sends `child_package_session_ids[]`

No existing API payloads need to change for this specific mapping route; this route uses a new API.

