# System Files API Documentation

## Overview

The System Files API provides a comprehensive solution for managing files with flexible access control. It supports multiple file types (File, URL, HTML), various media types, and granular access permissions at user, batch, role, and institute levels.

---

## Table of Contents

1. [Add System File](#1-add-system-file)
2. [List System Files by Access](#2-list-system-files-by-access)
3. [Get File Access Details](#3-get-file-access-details)
4. [Update File Access](#4-update-file-access)

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

## 3. Get File Access Details

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

## 4. Update File Access

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
