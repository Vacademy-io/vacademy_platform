# System Files API Documentation

## Overview

The System Files API provides a comprehensive solution for managing files with flexible access control. It supports multiple file types (File, URL, HTML), various media types, and granular access permissions at user, batch, role, and institute levels.

---

## Table of Contents

1. [Add System File](#1-add-system-file)
2. [List System Files by Access](#2-list-system-files-by-access)
3. [Get My Files](#3-get-my-files)
4. [Get File Access Details](#4-get-file-access-details)
5. [Update File Access](#5-update-file-access)
6. [Caching Strategy](#6-caching-strategy)

---

## 1. Add System File

### Endpoint

```
POST /admin-core-service/system-files/v1/add?instituteId={instituteId}
```

### Description

Creates a new system file with metadata and access permissions. The creator is automatically granted both view and edit access at the user level.

### Query Parameters

| Parameter     | Type     | Required | Description                    |
| ------------- | -------- | -------- | ------------------------------ |
| `instituteId` | `string` | ✅       | Institute ID for multi-tenancy |

### Request Payload

| Field               | Type       | Required | Description                                                            |
| ------------------- | ---------- | -------- | ---------------------------------------------------------------------- |
| `file_type`         | `string`   | ✅       | Type of file: `File`, `Url`, or `Html`                                 |
| `media_type`        | `string`   | ✅       | Media type: `video`, `audio`, `pdf`, `doc`, `image`, `note`, `unknown` |
| `data`              | `string`   | ✅       | File URL, HTML content, or file path                                   |
| `name`              | `string`   | ✅       | Display name of the file                                               |
| `folder_name`       | `string`   | ❌       | Folder/category for organization                                       |
| `thumbnail_file_id` | `string`   | ❌       | ID of thumbnail file (can reference another system file)               |
| `view_access`       | `object[]` | ❌       | Array of access permissions for viewing                                |
| `edit_access`       | `object[]` | ❌       | Array of access permissions for editing                                |

#### Access Object Structure

| Field      | Type     | Required | Description                                             |
| ---------- | -------- | -------- | ------------------------------------------------------- |
| `level`    | `string` | ✅       | Access level: `user`, `batch`, `role`, or `institute`   |
| `level_id` | `string` | ✅       | ID corresponding to the level (user_id, batch_id, etc.) |

### Sample Request

```json
{
  "file_type": "File",
  "media_type": "video",
  "data": "https://example.com/videos/intro.mp4",
  "name": "Introduction Video",
  "folder_name": "course-materials",
  "thumbnail_file_id": "thumb-uuid-123",
  "view_access": [
    {
      "level": "batch",
      "level_id": "batch-uuid-1"
    },
    {
      "level": "institute",
      "level_id": "inst-123"
    }
  ],
  "edit_access": [
    {
      "level": "role",
      "level_id": "ADMIN"
    }
  ]
}
```

### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Auto-Granted Access

The creator automatically receives:

- ✅ View access (user level)
- ✅ Edit access (user level)

These are **immutable** and cannot be removed.

### Curl Example

```bash
curl -X POST "http://localhost:8080/admin-core-service/system-files/v1/add?instituteId=inst-123" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "file_type": "File",
    "media_type": "video",
    "data": "https://example.com/videos/intro.mp4",
    "name": "Introduction Video",
    "folder_name": "course-materials",
    "view_access": [
      {
        "level": "batch",
        "level_id": "batch-uuid-1"
      }
    ],
    "edit_access": [
      {
        "level": "role",
        "level_id": "ADMIN"
      }
    ]
  }'
```

---

## 2. List System Files by Access

### Endpoint

```
GET /admin-core-service/system-files/v1/list?instituteId={instituteId}
```

### Description

Retrieves all system files that a specific user, batch, role, or institute has access to. Optionally filter by access type (view or edit).

### Query Parameters

| Parameter     | Type     | Required | Description                |
| ------------- | -------- | -------- | -------------------------- |
| `instituteId` | `string` | ✅       | Institute ID for filtering |

### Request Payload

| Field         | Type     | Required | Description                                                    |
| ------------- | -------- | -------- | -------------------------------------------------------------- |
| `level`       | `string` | ✅       | Access level to query: `user`, `batch`, `role`, or `institute` |
| `level_id`    | `string` | ✅       | ID for the specified level                                     |
| `access_type` | `string` | ❌       | Filter by access type: `view` or `edit` (omit for both)        |

### Sample Request

```json
{
  "level": "batch",
  "level_id": "batch-uuid-1",
  "access_type": "view"
}
```

### Response

```json
{
  "files": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "file_type": "File",
      "media_type": "video",
      "data": "https://example.com/videos/intro.mp4",
      "name": "Introduction Video",
      "folder_name": "course-materials",
      "thumbnail_file_id": "thumb-uuid-123",
      "created_at_iso": "2025-11-19T10:30:00.000Z",
      "updated_at_iso": "2025-11-19T10:30:00.000Z",
      "created_by": "John Doe",
      "access_types": ["view", "edit"]
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "file_type": "Url",
      "media_type": "pdf",
      "data": "https://example.com/docs/guide.pdf",
      "name": "Course Guide",
      "folder_name": "course-materials",
      "thumbnail_file_id": null,
      "created_at_iso": "2025-11-19T11:00:00.000Z",
      "updated_at_iso": "2025-11-19T11:00:00.000Z",
      "created_by": "Jane Smith",
      "access_types": ["view"]
    }
  ]
}
```

### Response Fields

| Field               | Type       | Description                                        |
| ------------------- | ---------- | -------------------------------------------------- |
| `id`                | `string`   | Unique file identifier                             |
| `file_type`         | `string`   | File type: `File`, `Url`, or `Html`                |
| `media_type`        | `string`   | Media type                                         |
| `data`              | `string`   | File URL, HTML content, or path                    |
| `name`              | `string`   | File display name                                  |
| `folder_name`       | `string`   | Folder/category name (nullable)                    |
| `thumbnail_file_id` | `string`   | Thumbnail file ID (nullable)                       |
| `created_at_iso`    | `string`   | Creation timestamp in ISO format                   |
| `updated_at_iso`    | `string`   | Last update timestamp in ISO format                |
| `created_by`        | `string`   | Full name of the creator                           |
| `access_types`      | `string[]` | List of access types for the queried level/levelId |

### Filtering Behavior

- Only returns files with status = `ACTIVE`
- Files are filtered by the specified `level` and `level_id`
- If `access_type` is provided, only files with that specific access type are returned
- Creator names are resolved from the auth service

### Curl Example

```bash
curl -X GET "http://localhost:8080/admin-core-service/system-files/v1/list?instituteId=inst-123" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "level": "user",
    "level_id": "user-uuid-123",
    "access_type": "edit"
  }'
```

---

## 3. Get My Files

### Endpoint

```
GET /admin-core-service/system-files/v1/my-files?instituteId={instituteId}
```

### Description

Retrieves ALL files that the authenticated user has access to through any method: direct user access, role-based access, batch membership, institute-level access, or files they created. This is the recommended endpoint for displaying "My Files" or "My Library" in the UI.

### Query Parameters

| Parameter     | Type     | Required | Description                |
| ------------- | -------- | -------- | -------------------------- |
| `instituteId` | `string` | ✅       | Institute ID for filtering |

### Request Payload

| Field         | Type       | Required | Description                                                     |
| ------------- | ---------- | -------- | --------------------------------------------------------------- |
| `user_roles`  | `string[]` | ❌       | User's roles for role-based access (e.g., ["ADMIN", "TEACHER"]) |
| `access_type` | `string`   | ❌       | Filter by access type: `view` or `edit` (omit for both)         |
| `statuses`    | `string[]` | ❌       | Filter by file status (defaults to ["ACTIVE"] if not provided)  |

### Sample Request

```json
{
  "user_roles": ["ADMIN", "TEACHER"],
  "access_type": "view",
  "statuses": ["ACTIVE", "ARCHIVED"]
}
```

### Response

```json
{
  "files": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "file_type": "File",
      "media_type": "video",
      "data": "https://example.com/videos/intro.mp4",
      "name": "Introduction Video",
      "folder_name": "course-materials",
      "thumbnail_file_id": "thumb-uuid-123",
      "created_at_iso": "2025-11-19T10:30:00.000Z",
      "updated_at_iso": "2025-11-19T10:30:00.000Z",
      "created_by": "John Doe",
      "access_types": ["view", "edit"]
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "file_type": "Url",
      "media_type": "pdf",
      "data": "https://example.com/docs/guide.pdf",
      "name": "Course Guide",
      "folder_name": "course-materials",
      "thumbnail_file_id": null,
      "created_at_iso": "2025-11-19T11:00:00.000Z",
      "updated_at_iso": "2025-11-19T11:00:00.000Z",
      "created_by": "Jane Smith",
      "access_types": ["view"]
    }
  ]
}
```

### Access Resolution Logic

The API automatically includes files where user has access through:

1. **Direct User Access** - Files explicitly shared with the user (`level=user, level_id=userId`)
2. **Role-Based Access** - Files shared with any of the user's roles (`level=role, level_id in userRoles`)
3. **Batch Access** - Files shared with any batch the user belongs to (via `student_session_institute_group_mapping`)
4. **Institute Access** - Files shared with the entire institute (`level=institute, level_id=instituteId`)
5. **Creator Access** - Files created by the user (automatic view + edit access)

### Filtering Behavior

#### Status Filter

- **Default:** Returns only `ACTIVE` files if `statuses` is not provided
- **Custom:** Provide array of statuses to include: `["ACTIVE", "ARCHIVED"]` or `["DELETED"]`
- **All statuses:** Provide `["ACTIVE", "DELETED", "ARCHIVED"]`

#### Access Type Filter

- **Null/Empty:** Returns files with any access type (view OR edit)
- **"view":** Only files user can view
- **"edit":** Only files user can edit

#### User Roles

- **Optional:** If not provided, skips role-based access checks
- **Provided:** Checks if any of the provided roles have access to files
- **Format:** Array of role names (e.g., `["ADMIN", "TEACHER", "COORDINATOR"]`)

### Example Use Cases

#### Get all active files I can access

```json
{
  "user_roles": ["TEACHER"]
}
```

#### Get only files I can edit (including archived)

```json
{
  "user_roles": ["ADMIN"],
  "access_type": "edit",
  "statuses": ["ACTIVE", "ARCHIVED"]
}
```

#### Get only my created files

```json
{
  "statuses": ["ACTIVE"]
}
```

(Will include files created by user plus any files explicitly shared)

### Curl Example

```bash
curl -X GET "http://localhost:8080/admin-core-service/system-files/v1/my-files?instituteId=inst-123" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "user_roles": ["ADMIN", "TEACHER"],
    "access_type": "view",
    "statuses": ["ACTIVE"]
  }'
```

### Performance Notes

- User batches are fetched from `student_session_institute_group_mapping` table
- Multiple access paths are combined (OR logic)
- Files are deduplicated automatically
- Creator names resolved from auth service (cached)
- Uses indexed queries on `entity_access` table

---

## 4. Get File Access Details

### Endpoint

```
GET /admin-core-service/system-files/v1/access?systemFileId={systemFileId}&instituteId={instituteId}
```

### Description

Retrieves comprehensive access details for a specific file, including all access permissions and file metadata. Open to any authenticated user in the institute for transparency.

### Query Parameters

| Parameter      | Type     | Required | Description                |
| -------------- | -------- | -------- | -------------------------- |
| `systemFileId` | `string` | ✅       | ID of the system file      |
| `instituteId`  | `string` | ✅       | Institute ID for filtering |

### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Introduction Video",
  "file_type": "File",
  "media_type": "video",
  "data": "https://example.com/videos/intro.mp4",
  "status": "ACTIVE",
  "created_by": "John Doe",
  "created_by_user_id": "user-uuid-123",
  "created_at_iso": "2025-11-19T10:30:00.000Z",
  "updated_at_iso": "2025-11-19T10:30:00.000Z",
  "access_list": [
    {
      "id": "access-uuid-1",
      "access_type": "view",
      "level": "user",
      "level_id": "user-uuid-123",
      "is_creator": true,
      "created_at_iso": "2025-11-19T10:30:00.000Z"
    },
    {
      "id": "access-uuid-2",
      "access_type": "edit",
      "level": "user",
      "level_id": "user-uuid-123",
      "is_creator": true,
      "created_at_iso": "2025-11-19T10:30:00.000Z"
    },
    {
      "id": "access-uuid-3",
      "access_type": "view",
      "level": "batch",
      "level_id": "batch-uuid-1",
      "is_creator": false,
      "created_at_iso": "2025-11-19T10:35:00.000Z"
    },
    {
      "id": "access-uuid-4",
      "access_type": "edit",
      "level": "role",
      "level_id": "ADMIN",
      "is_creator": false,
      "created_at_iso": "2025-11-19T10:40:00.000Z"
    }
  ]
}
```

### Response Fields

#### File Metadata

| Field                | Type     | Description                                  |
| -------------------- | -------- | -------------------------------------------- |
| `id`                 | `string` | File unique identifier                       |
| `name`               | `string` | File display name                            |
| `file_type`          | `string` | File type: `File`, `Url`, or `Html`          |
| `media_type`         | `string` | Media type                                   |
| `data`               | `string` | File URL, HTML content, or path              |
| `status`             | `string` | File status: `ACTIVE`, `DELETED`, `ARCHIVED` |
| `created_by`         | `string` | Creator's full name                          |
| `created_by_user_id` | `string` | Creator's user ID                            |
| `created_at_iso`     | `string` | Creation timestamp                           |
| `updated_at_iso`     | `string` | Last update timestamp                        |

#### Access List Item

| Field            | Type      | Description                                        |
| ---------------- | --------- | -------------------------------------------------- |
| `id`             | `string`  | Access record ID                                   |
| `access_type`    | `string`  | Access type: `view` or `edit`                      |
| `level`          | `string`  | Access level: `user`, `batch`, `role`, `institute` |
| `level_id`       | `string`  | ID for the specified level                         |
| `is_creator`     | `boolean` | True if this access belongs to the file creator    |
| `created_at_iso` | `string`  | When this access was granted                       |

### Access Transparency

- ✅ Any authenticated user in the institute can view access details
- ✅ Works for files with any status (ACTIVE, DELETED, ARCHIVED)
- ✅ Creator's access is marked with `is_creator: true`
- ✅ No level name resolution (IDs only for performance)

### Curl Example

```bash
curl -X GET "http://localhost:8080/admin-core-service/system-files/v1/access?systemFileId=550e8400-e29b-41d4-a716-446655440000&instituteId=inst-123" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 5. Update File Access

### Endpoint

```
PUT /admin-core-service/system-files/v1/access?instituteId={instituteId}
```

### Description

Updates access permissions for an existing file. Only users with edit access can perform this operation. The creator's view and edit access are immutable and always preserved.

### Query Parameters

| Parameter     | Type     | Required | Description                |
| ------------- | -------- | -------- | -------------------------- |
| `instituteId` | `string` | ✅       | Institute ID for filtering |

### Request Payload

| Field            | Type       | Required | Description                                            |
| ---------------- | ---------- | -------- | ------------------------------------------------------ |
| `system_file_id` | `string`   | ✅       | ID of the file to update                               |
| `user_roles`     | `string[]` | ❌       | Current user's roles for role-based authorization      |
| `status`         | `string`   | ❌       | Update file status: `ACTIVE`, `DELETED`, or `ARCHIVED` |
| `view_access`    | `object[]` | ❌       | New view access permissions (replaces existing)        |
| `edit_access`    | `object[]` | ❌       | New edit access permissions (replaces existing)        |

#### Access Object Structure

| Field      | Type     | Required | Description                                           |
| ---------- | -------- | -------- | ----------------------------------------------------- |
| `level`    | `string` | ✅       | Access level: `user`, `batch`, `role`, or `institute` |
| `level_id` | `string` | ✅       | ID corresponding to the level                         |

### Sample Request

```json
{
  "system_file_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_roles": ["ADMIN", "TEACHER"],
  "status": "ACTIVE",
  "view_access": [
    {
      "level": "batch",
      "level_id": "batch-uuid-1"
    },
    {
      "level": "user",
      "level_id": "user-uuid-2"
    }
  ],
  "edit_access": [
    {
      "level": "role",
      "level_id": "ADMIN"
    }
  ]
}
```

### Response

```json
{
  "success": true,
  "message": "Access updated successfully",
  "updated_access_count": 5
}
```

### Authorization Logic

User must have edit access through **any** of these methods (checked in order):

1. **Creator** - User is the file creator (auto-granted during creation)
2. **Direct User Access** - User has user-level edit access
3. **Role Access** - Any of user's roles (from `user_roles`) has edit access
4. **Batch Access** - Any of user's batches has edit access (via `student_session_institute_group_mapping`)
5. **Institute Access** - The institute itself has edit access

If none match, returns `403 Forbidden`.

### Update Behavior

#### Full Replacement Strategy

- ✅ Deletes all existing access records
- ✅ Creates new access records from request
- ✅ **Always preserves creator's view + edit access** (immutable)
- ✅ Empty arrays make file private (only creator access)

#### Creator Access Protection

The creator's access is **immutable**:

- Even if not included in request, automatically re-added
- Cannot be downgraded or removed
- Always maintains both view and edit at user level

#### Status Update

- Optional field in request
- Can transition between: `ACTIVE`, `DELETED`, `ARCHIVED`
- Independent of access management
- Useful for soft-delete and archival workflows

### Special Cases

#### Make File Private

```json
{
  "system_file_id": "550e8400-e29b-41d4-a716-446655440000",
  "view_access": [],
  "edit_access": []
}
```

Result: Only creator has access (view + edit)

#### Update Status Only

```json
{
  "system_file_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ARCHIVED"
}
```

Result: File archived, access permissions unchanged

#### Grant Institute-Wide Access

```json
{
  "system_file_id": "550e8400-e29b-41d4-a716-446655440000",
  "view_access": [
    {
      "level": "institute",
      "level_id": "inst-123"
    }
  ]
}
```

Result: All users in institute can view the file

### Curl Example

```bash
curl -X PUT "http://localhost:8080/admin-core-service/system-files/v1/access?instituteId=inst-123" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "system_file_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_roles": ["ADMIN", "TEACHER"],
    "status": "ACTIVE",
    "view_access": [
      {
        "level": "batch",
        "level_id": "batch-uuid-1"
      }
    ],
    "edit_access": [
      {
        "level": "role",
        "level_id": "ADMIN"
      }
    ]
  }'
```

---

## 6. Caching Strategy

### Overview

The System Files API implements a **dual-layer caching strategy** to optimize performance while maintaining data freshness:

1. **Client-Side Caching** (HTTP Cache-Control headers) - Reduces network requests
2. **Server-Side Caching** (Caffeine in-memory cache) - Reduces database queries

---

### Client-Side Caching (HTTP Headers)

All GET endpoints include `Cache-Control` headers to enable browser/CDN caching.

#### Cache Configuration by Endpoint

| Endpoint | Cache Duration | Scope | Vary Headers |
|----------|---------------|-------|--------------|
| `GET /list` | **2 minutes** | `private` | `X-Institute-Id`, `X-User-Id` |
| `GET /access` | **5 minutes** | `private` | `X-Institute-Id` |
| `GET /my-files` | **1 minute** | `private` | `X-Institute-Id`, `X-User-Id` |
| `POST /add` | No cache | - | - |
| `PUT /access` | No cache | - | - |

#### Example Response Headers

```http
HTTP/1.1 200 OK
Cache-Control: private, max-age=120
Vary: Authorization, X-Institute-Id, X-User-Id, X-Package-Session-Id
Content-Type: application/json
```

#### How It Works

**First Request:**
```
User A → Server (cache MISS) → Database → Response (200 OK)
         ← Cache-Control: private, max-age=120
Browser stores response for 2 minutes
```

**Subsequent Requests (within 2 min):**
```
User A → Browser Cache (cache HIT) → Instant Response (0ms)
No network request made!
```

#### Cache Scope: `private`

- ✅ Response is user-specific
- ✅ Not cached by shared proxies/CDNs
- ✅ Only cached in user's browser
- ✅ Different users get separate caches

#### Vary Headers

Ensures cache is unique per:
- **Authorization**: Different users get different caches
- **X-Institute-Id**: Different institutes get different caches
- **X-User-Id**: User-specific data properly isolated

---

### Server-Side Caching (Caffeine)

Only the `/list` endpoint uses server-side caching to benefit multiple users querying the same batch/role files.

#### Cache Configuration

| Cache Name | TTL | Max Size | Purpose |
|------------|-----|----------|---------|
| `systemFileList` | **3 minutes** | 1000 entries | Batch/role file listings |

#### How It Works

**Request 1 (User A - batch-123 files):**
```
User A → Server (cache MISS) → Database (15 DB queries) → Response (500ms)
         Server cache stores result with key: "batch:batch-123:view:inst-1"
```

**Request 2 (User B - same batch):**
```
User B → Server (cache HIT) → Cached response (5ms)
         No database queries!
```

**Request 3 (User C - different batch):**
```
User C → Server (cache MISS, different key) → Database → Response
         Server cache stores with key: "batch:batch-456:view:inst-1"
```

#### Cache Key Structure

```
level:levelId:accessType:instituteId
```

**Examples:**
- `"batch:batch-123:view:inst-1"` - View access for batch-123
- `"role:ADMIN:edit:inst-1"` - Edit access for ADMIN role
- `"user:user-456:view:inst-2"` - View access for specific user

#### Why Only `/list` Has Server Cache?

| Endpoint | Server Cache | Reason |
|----------|--------------|--------|
| `/list` | ✅ Yes | **Shared data** - Multiple users query same batch/role files |
| `/access` | ❌ No | **File-specific** - Less frequently accessed, client cache sufficient |
| `/my-files` | ❌ No | **User-specific** - Each user has unique result, less cache sharing benefit |

---

### Cache Invalidation

Caches are automatically cleared when data changes to prevent stale information.

#### POST /add - Creates New File

**Server-Side:**
```java
@CacheEvict(value = "systemFileList", allEntries = true)
```
- ✅ Clears ALL cached file listings
- ✅ Next request fetches fresh data from database
- ✅ Ensures new files appear immediately

**Client-Side:**
- ❌ No automatic invalidation
- ⚠️ Users may see old data for up to 1-2 minutes
- ✅ Acceptable delay for non-critical updates

#### PUT /access - Updates Permissions

**Server-Side:**
```java
@CacheEvict(value = "systemFileList", allEntries = true)
```
- ✅ Clears cached file listings
- ✅ Access changes reflect on next query

**Client-Side:**
- ❌ No automatic invalidation
- ⚠️ Cached responses remain valid until TTL expires
- ✅ Users refresh page to see updated permissions

---

### Performance Benefits

#### Without Caching

```
50 students check batch files (same batch):
→ 50 HTTP requests
→ 50 database queries (15 queries each = 750 total queries!)
→ 50 × 500ms = 25 seconds total response time
```

#### With Dual-Layer Caching

```
50 students check batch files (same batch):

Student 1:  → Server (cache MISS) → DB query (500ms)
            → Cache stored (server + browser)

Students 2-50 (within 2 min):
            → Browser cache HIT (0ms network, instant!)
            → No server requests, no DB queries

Total: 1 DB query, 49 instant responses
Performance improvement: 98% reduction in load
```

#### Real-World Metrics

| Metric | Without Cache | With Cache | Improvement |
|--------|--------------|------------|-------------|
| **Response Time** | 200-500ms | 0-10ms | **50x faster** |
| **DB Queries** | 100% requests | ~20% requests | **80% reduction** |
| **Server Load** | High | Low | **90% reduction** |
| **Network Traffic** | 100% requests | ~30% requests | **70% reduction** |

---

### Cache Headers in Practice

#### Example 1: Successful Cache Hit

```bash
# First request
curl -I "http://localhost:8080/admin-core-service/system-files/v1/list?instituteId=inst-1"

HTTP/1.1 200 OK
Cache-Control: private, max-age=120
Vary: Authorization, X-Institute-Id, X-User-Id
Age: 0

# Second request (within 2 min) - Browser serves from cache
# No HTTP request made!
```

#### Example 2: Force Fresh Data

```bash
# Add cache-busting header to bypass cache
curl "http://localhost:8080/admin-core-service/system-files/v1/list?instituteId=inst-1" \
  -H "Cache-Control: no-cache"
```

#### Example 3: Check Cache Age

```bash
curl -I "http://localhost:8080/admin-core-service/system-files/v1/list?instituteId=inst-1"

HTTP/1.1 200 OK
Cache-Control: private, max-age=120
Age: 45  # ← Response is 45 seconds old, still fresh for 75 seconds
```

---

### Best Practices for Clients

#### 1. Respect Cache Headers

```javascript
// ✅ GOOD - Let browser handle caching
fetch('/admin-core-service/system-files/v1/list?instituteId=inst-1')
  .then(res => res.json());

// ❌ BAD - Disabling cache unnecessarily
fetch('/admin-core-service/system-files/v1/list?instituteId=inst-1', {
  cache: 'no-store'  // Don't do this!
});
```

#### 2. Force Refresh When Needed

```javascript
// Force fresh data after creating/updating a file
async function refreshFileList() {
  const response = await fetch('/list?instituteId=inst-1', {
    headers: { 'Cache-Control': 'no-cache' }
  });
  return response.json();
}
```

#### 3. Handle Stale Data Gracefully

```javascript
// Show loading indicator while fetching
async function getFiles() {
  try {
    const response = await fetch('/list?instituteId=inst-1');
    
    // Check if response is from cache
    const age = response.headers.get('Age');
    if (age && parseInt(age) > 60) {
      console.log('Using cached data (may be stale)');
    }
    
    return response.json();
  } catch (error) {
    // Fallback to cached data if network fails
  }
}
```

#### 4. Optimize for Mobile

```javascript
// Longer cache acceptable on slow networks
const cacheTime = navigator.connection?.effectiveType === '4g' ? 60 : 120;
// API already handles this, but client can extend cache locally
```

---

### Monitoring Cache Performance

#### Server-Side Cache Stats

```java
// Available cache statistics (for monitoring)
CacheStats stats = cacheManager.getCache("systemFileList")
    .getNativeCache()
    .stats();

System.out.println("Hit Rate: " + stats.hitRate());        // Target: >70%
System.out.println("Miss Rate: " + stats.missRate());      // Target: <30%
System.out.println("Eviction Count: " + stats.evictionCount());
```

#### Client-Side Monitoring

```javascript
// Check browser cache usage
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('/system-files/'))
  .forEach(r => {
    console.log(`${r.name}: ${r.transferSize === 0 ? 'CACHED' : 'NETWORK'}`);
  });
```

---

### Troubleshooting

#### Problem: Seeing Stale Data

**Symptom:** Added a file but it doesn't appear in list  
**Cause:** Client cache still valid  
**Solution:** 
1. Wait for cache to expire (1-2 min), OR
2. Hard refresh (Ctrl+Shift+R), OR
3. Add `Cache-Control: no-cache` header to request

#### Problem: Cache Not Working

**Symptom:** Every request hits server  
**Cause:** Missing or disabled cache headers  
**Solution:**
1. Check response headers include `Cache-Control`
2. Verify browser cache not disabled
3. Check proxy/CDN configuration

#### Problem: High Server Load

**Symptom:** Many database queries despite caching  
**Cause:** Cache TTL too short or different cache keys  
**Solution:**
1. Check cache hit rate in monitoring
2. Verify requests use same level/levelId/accessType
3. Consider increasing TTL if data is stable

---

### Cache Behavior Summary

| Operation | Server Cache | Client Cache | Data Freshness |
|-----------|--------------|--------------|----------------|
| **GET /list** (first time) | MISS → Store | MISS → Store | Fresh from DB |
| **GET /list** (repeat, same params) | HIT → Instant | HIT → No request | Cached (fresh) |
| **GET /list** (different params) | MISS → Store | MISS → Store | Fresh from DB |
| **POST /add** | Evict all | N/A | Clears server cache |
| **PUT /access** | Evict all | N/A | Clears server cache |
| **GET /access** | Not cached | MISS → Store | Fresh from DB |
| **GET /my-files** | Not cached | MISS → Store | Fresh from DB |

---

## Common Patterns

### 1. Creating a Course Material

```bash
# Create a video accessible to all students in a batch
curl -X POST ".../add?instituteId=inst-123" \
  -d '{
    "file_type": "File",
    "media_type": "video",
    "data": "https://cdn.example.com/lecture-1.mp4",
    "name": "Lecture 1: Introduction",
    "folder_name": "Week 1",
    "view_access": [
      {"level": "batch", "level_id": "batch-spring-2025"}
    ],
    "edit_access": [
      {"level": "role", "level_id": "TEACHER"}
    ]
  }'
```

### 2. Sharing with Specific Users

```bash
# Share a document with specific users
curl -X POST ".../add?instituteId=inst-123" \
  -d '{
    "file_type": "Url",
    "media_type": "pdf",
    "data": "https://example.com/assignment.pdf",
    "name": "Assignment Guidelines",
    "view_access": [
      {"level": "user", "level_id": "student-1"},
      {"level": "user", "level_id": "student-2"}
    ]
  }'
```

### 3. Institute-Wide Announcement

```bash
# Create HTML content visible to entire institute
curl -X POST ".../add?instituteId=inst-123" \
  -d '{
    "file_type": "Html",
    "media_type": "note",
    "data": "<h1>Important Notice</h1><p>Classes suspended tomorrow.</p>",
    "name": "Holiday Notice",
    "view_access": [
      {"level": "institute", "level_id": "inst-123"}
    ],
    "edit_access": [
      {"level": "role", "level_id": "ADMIN"}
    ]
  }'
```

### 4. Archiving Old Content

```bash
# Archive a file while preserving access records
curl -X PUT ".../access?instituteId=inst-123" \
  -d '{
    "system_file_id": "file-uuid",
    "status": "ARCHIVED"
  }'
```

### 5. Upgrading Access Permissions

```bash
# Grant edit access to additional roles
curl -X PUT ".../access?instituteId=inst-123" \
  -d '{
    "system_file_id": "file-uuid",
    "user_roles": ["ADMIN"],
    "view_access": [
      {"level": "batch", "level_id": "batch-1"}
    ],
    "edit_access": [
      {"level": "role", "level_id": "ADMIN"},
      {"level": "role", "level_id": "TEACHER"},
      {"level": "role", "level_id": "COORDINATOR"}
    ]
  }'
```

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "Invalid file type: InvalidType. Must be one of: File, Url, Html"
}
```

**Common Causes:**

- Invalid enum values (file_type, media_type, access level, status)
- Missing required fields
- Malformed request body

### 403 Forbidden

```json
{
  "error": "User does not have edit access to update this file's permissions"
}
```

**Cause:** User attempting to update access without edit permissions

### 404 Not Found

```json
{
  "error": "System file not found with ID: invalid-uuid"
}
```

**Common Causes:**

- File doesn't exist
- File belongs to different institute
- Invalid file ID format

---

## Database Schema

### system_files Table

| Column               | Type        | Description                               |
| -------------------- | ----------- | ----------------------------------------- |
| `id`                 | `VARCHAR`   | Primary key (UUID)                        |
| `file_type`          | `VARCHAR`   | File, Url, or Html                        |
| `media_type`         | `VARCHAR`   | video, audio, pdf, doc, image, note, etc. |
| `data`               | `TEXT`      | URL, HTML content, or file path           |
| `name`               | `VARCHAR`   | Display name                              |
| `folder_name`        | `VARCHAR`   | Organization folder (nullable)            |
| `thumbnail_file_id`  | `VARCHAR`   | Reference to another system file          |
| `institute_id`       | `VARCHAR`   | Foreign key to institutes                 |
| `created_by_user_id` | `VARCHAR`   | Creator's user ID                         |
| `status`             | `VARCHAR`   | ACTIVE, DELETED, or ARCHIVED              |
| `created_at`         | `TIMESTAMP` | Creation timestamp                        |
| `updated_at`         | `TIMESTAMP` | Last update timestamp                     |

### entity_access Table

| Column        | Type        | Description                     |
| ------------- | ----------- | ------------------------------- |
| `id`          | `VARCHAR`   | Primary key (UUID)              |
| `entity`      | `VARCHAR`   | Always 'system_file'            |
| `entity_id`   | `VARCHAR`   | Foreign key to system_files.id  |
| `access_type` | `VARCHAR`   | view or edit                    |
| `level`       | `VARCHAR`   | user, batch, role, or institute |
| `level_id`    | `VARCHAR`   | ID for the specified level      |
| `created_at`  | `TIMESTAMP` | When access was granted         |
| `updated_at`  | `TIMESTAMP` | Last update timestamp           |

---

## Enums Reference

### FileTypeEnum

- `File` - Regular file (video, PDF, image, etc.)
- `Url` - External URL reference
- `Html` - Embedded HTML content

### MediaTypeEnum

- `video` - Video content
- `audio` - Audio files
- `pdf` - PDF documents
- `doc` - Word documents or text files
- `image` - Images
- `note` - Text notes or announcements
- `unknown` - Unspecified media type

### AccessLevelEnum

- `user` - Individual user access
- `batch` - Package session / batch access
- `role` - Role-based access (e.g., ADMIN, TEACHER)
- `institute` - Institute-wide access

### AccessTypeEnum

- `view` - Read-only access
- `edit` - Modify and manage permissions

### StatusEnum

- `ACTIVE` - File is active and accessible
- `DELETED` - Soft-deleted file
- `ARCHIVED` - Archived file (retained but not actively used)

---

## Best Practices

1. **Use Appropriate File Types**

   - `File` for uploaded media (videos, PDFs, images)
   - `Url` for external resources (YouTube, Google Docs)
   - `Html` for rich text announcements or notes

2. **Organize with Folders**

   - Use consistent naming conventions
   - Group related content (e.g., "Week 1", "Assignments", "Resources")

3. **Granular Access Control**

   - Start restrictive, expand as needed
   - Use batch-level for course materials
   - Use role-level for administrative files
   - Use institute-level for announcements

4. **Status Management**

   - Use `ARCHIVED` for old content (keeps history)
   - Use `DELETED` for removed content
   - Never hard-delete files with access history

5. **Frontend Validation**

   - Validate enum values before submission
   - Prevent duplicate access entries
   - Confirm user roles before update operations

6. **Performance Considerations**
   - Batch ID queries leverage `student_session_institute_group_mapping`
   - Creator name resolution cached from auth service
   - Status filtering done at database level

---

## Migration Notes

### V41: Initial Schema

- Created `system_files` table
- Created `entity_access` table
- Basic constraints and indexes

### V42: Extended Types

- Added `Html` file type
- Added `ARCHIVED` status
- Updated CHECK constraints

---

## Support

For issues or questions:

- Check server logs for detailed error messages
- Verify authentication tokens are valid
- Ensure institute IDs match user permissions
- Validate all enum values against documentation
