# Planning Logs API Documentation

## Overview
The Planning Logs API allows teachers and admins to create, list, and update planning and diary logs. These logs can be associated with different entities (package sessions, subjects, etc.) and organized by various interval types (daily, weekly, monthly, quarterly).

## Base URL
```
/admin-core-service/planning-logs/v1
```

---

## Endpoints

### 1. Create Planning Logs (Batch)

**Endpoint:** `POST /create`

**Description:** Create one or more planning/diary logs in a single request.

**Query Parameters:**
- `instituteId` (required): Institute ID

**Request Headers:**
- `Authorization`: Bearer token
- `Content-Type`: application/json

**Request Body:**
```json
{
  "logs": [
    {
      "log_type": "planning",
      "entity": "packageSession",
      "entity_id": "session-uuid",
      "interval_type": "monthly",
      "interval_type_id": "2024_01_W01",
      "title": "Week 1 Planning",
      "description": "Planning for first week of the month",
      "content_html": "<p>Detailed planning content in HTML</p>",
      "subject_id": "subject-uuid",
      "comma_separated_file_ids": "file1-uuid,file2-uuid"
    }
  ]
}
```

**Field Descriptions:**
- `log_type`: Type of log - `"planning"` or `"diary"`
- `entity`: Entity type - `"packageSession"`, `"subject"`, etc.
- `entity_id`: UUID of the associated entity
- `interval_type`: Time interval - `"daily"`, `"weekly"`, `"monthly"`, `"yearly_month"`, `"yearly_quarter"`
- `interval_type_id`: Formatted interval identifier (see format below)
- `title`: Log title
- `description`: Optional description
- `content_html`: HTML content of the log
- `subject_id`: Associated subject UUID
- `comma_separated_file_ids`: Optional comma-separated file UUIDs

**Interval Type ID Formats:**
- Daily: `YYYY-MM-DD` (e.g., `2024-11-26` for November 26, 2024) - ISO date format
- Weekly: `YYYY_D0X` (e.g., `2024_D01` for Monday, `2024_D07` for Sunday) - Day of week (1-7)
- Monthly: `YYYY_MM_W0X` (e.g., `2024_01_W01` for first week of January, `2024_03_W03` for third week of March) - Week of specific month (1-5)
- Yearly Month: `YYYY_MXX` (e.g., `2024_M01` for January, `2024_M12` for December) - Month of year (01-12)
- Yearly Quarter: `YYYY_Q0X` (e.g., `2024_Q01` for Q1, `2024_Q04` for Q4) - Quarter (1-4)

**Response:**
```json
{
  "logs": [
    {
      "id": "log-uuid",
      "created_by_user_id": "user-uuid",
      "log_type": "planning",
      "entity": "packageSession",
      "entity_id": "session-uuid",
      "interval_type": "monthly",
      "interval_type_id": "2024_01_W01",
      "title": "Week 1 Planning",
      "description": "Planning for first week of the month",
      "content_html": "<p>Detailed planning content in HTML</p>",
      "subject_id": "subject-uuid",
      "comma_separated_file_ids": "file1-uuid,file2-uuid",
      "status": "ACTIVE",
      "institute_id": "institute-uuid",
      "created_at": "2024-01-15T10:30:00",
      "updated_at": "2024-01-15T10:30:00"
    }
  ],
  "message": "Successfully created 1 planning log(s)"
}
```

**Status Codes:**
- `201 Created`: Logs created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication

**Cache Behavior:**
- Evicts all cached list responses on success

---

### 2. List Planning Logs (Paginated)

**Endpoint:** `POST /list`

**Description:** Retrieve a paginated list of planning logs with optional filtering.

**Query Parameters:**
- `instituteId` (required): Institute ID
- `pageNo` (optional, default: 0): Page number (0-indexed)
- `pageSize` (optional, default: 20): Number of items per page

**Request Headers:**
- `Authorization`: Bearer token
- `Content-Type`: application/json

**Request Body (all fields optional):**
```json
{
  "interval_types": ["monthly", "yearly_month"],
  "interval_type_ids": ["2024_01_W01", "2024_M01"],
  "created_by_user_ids": ["user-uuid-1", "user-uuid-2"],
  "log_types": ["planning", "diary"],
  "entity_ids": ["session-uuid-1", "session-uuid-2"],
  "subject_ids": ["subject-uuid-1"],
  "statuses": ["ACTIVE", "DELETED"]
}
```

**Filter Behavior:**
- Empty request `{}`: Returns all logs for the institute
- Arrays with empty strings `[""]`: Treated as no filter
- Multiple values in array: Returns logs matching ANY of the values (OR logic)
- Multiple filter fields: Returns logs matching ALL filter conditions (AND logic)

**Response:**
```json
{
  "content": [
    {
      "id": "log-uuid",
      "created_by_user_id": "user-uuid",
      "log_type": "planning",
      "entity": "packageSession",
      "entity_id": "session-uuid",
      "interval_type": "monthly",
      "interval_type_id": "2024_01_W01",
      "title": "Week 1 Planning",
      "description": "Planning for first week",
      "content_html": "<p>Content</p>",
      "subject_id": "subject-uuid",
      "comma_separated_file_ids": "file1-uuid",
      "status": "ACTIVE",
      "institute_id": "institute-uuid",
      "created_at": "2024-01-15T10:30:00",
      "updated_at": "2024-01-15T10:30:00"
    }
  ],
  "pageable": {
    "sort": {
      "sorted": true,
      "unsorted": false,
      "empty": false
    },
    "pageNumber": 0,
    "pageSize": 20,
    "offset": 0,
    "paged": true,
    "unpaged": false
  },
  "totalPages": 5,
  "totalElements": 95,
  "last": false,
  "first": true,
  "size": 20,
  "number": 0,
  "sort": {
    "sorted": true,
    "unsorted": false,
    "empty": false
  },
  "numberOfElements": 20,
  "empty": false
}
```

**Status Codes:**
- `200 OK`: Logs retrieved successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication

**Cache Behavior:**
- Server-side cached based on institute, page, size, and filters
- Cache automatically cleared on create/update operations

---

### 3. Update Planning Log

**Endpoint:** `PATCH /{logId}`

**Description:** Update specific fields of an existing planning log. Only the creator can update their logs.

**Path Parameters:**
- `logId` (required): UUID of the log to update

**Query Parameters:**
- `instituteId` (required): Institute ID

**Request Headers:**
- `Authorization`: Bearer token
- `Content-Type`: application/json

**Request Body (all fields optional):**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "content_html": "<p>Updated content</p>",
  "comma_separated_file_ids": "file3-uuid,file4-uuid",
  "status": "DELETED"
}
```

**Field Descriptions:**
- `title`: Update log title
- `description`: Update description
- `content_html`: Update HTML content
- `comma_separated_file_ids`: Update attached files
- `status`: Update status (set to `"DELETED"` to soft delete)

**Partial Update:**
Only fields provided in the request will be updated. Omitted fields remain unchanged.

**Response:**
```json
{
  "id": "log-uuid",
  "created_by_user_id": "user-uuid",
  "log_type": "planning",
  "entity": "packageSession",
  "entity_id": "session-uuid",
  "interval_type": "monthly",
  "interval_type_id": "2024_01_W01",
  "title": "Updated Title",
  "description": "Updated description",
  "content_html": "<p>Updated content</p>",
  "subject_id": "subject-uuid",
  "comma_separated_file_ids": "file3-uuid,file4-uuid",
  "status": "ACTIVE",
  "institute_id": "institute-uuid",
  "created_at": "2024-01-15T10:30:00",
  "updated_at": "2024-01-15T11:45:00"
}
```

**Status Codes:**
- `200 OK`: Log updated successfully
- `400 Bad Request`: Invalid request data or log not found
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User doesn't have permission to update this log

**Cache Behavior:**
- Evicts all cached list responses on success

---

## Common Error Responses

### 400 Bad Request
```json
{
  "timestamp": "2024-01-15T10:30:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Invalid interval_type_id format",
  "path": "/admin-core-service/planning-logs/v1/create"
}
```

### 401 Unauthorized
```json
{
  "timestamp": "2024-01-15T10:30:00",
  "status": 401,
  "error": "Unauthorized",
  "message": "Full authentication is required to access this resource",
  "path": "/admin-core-service/planning-logs/v1/list"
}
```

### 403 Forbidden
```json
{
  "timestamp": "2024-01-15T10:30:00",
  "status": 403,
  "error": "Forbidden",
  "message": "You don't have permission to update this planning log",
  "path": "/admin-core-service/planning-logs/v1/abc-123"
}
```

---

## Usage Examples

### Example 1: Create a Single Planning Log
```bash
curl -X POST "http://localhost:8080/admin-core-service/planning-logs/v1/create?instituteId=inst-123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [{
      "log_type": "planning",
      "entity": "packageSession",
      "entity_id": "session-456",
      "interval_type": "monthly",
      "interval_type_id": "2024_01_W01",
      "title": "Week 1 Math Planning",
      "description": "Algebra basics",
      "content_html": "<h2>Topics</h2><ul><li>Linear equations</li></ul>",
      "subject_id": "math-789"
    }]
  }'
```

### Example 2: List All Active Logs (First Page)
```bash
curl -X POST "http://localhost:8080/admin-core-service/planning-logs/v1/list?instituteId=inst-123&pageNo=0&pageSize=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "statuses": ["ACTIVE"]
  }'
```

### Example 3: Filter by Multiple Criteria
```bash
curl -X POST "http://localhost:8080/admin-core-service/planning-logs/v1/list?instituteId=inst-123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "log_types": ["planning"],
    "interval_types": ["monthly", "yearly_month"],
    "subject_ids": ["math-789", "science-101"]
  }'
```

### Example 4: Update Log Title and Mark as Deleted
```bash
curl -X PATCH "http://localhost:8080/admin-core-service/planning-logs/v1/log-uuid?instituteId=inst-123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Archived: Week 1 Planning",
    "status": "DELETED"
  }'
```

### Example 5: Get Deleted Logs Only
```bash
curl -X POST "http://localhost:8080/admin-core-service/planning-logs/v1/list?instituteId=inst-123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "statuses": ["DELETED"]
  }'
```

---

## Data Model

### TeacherPlanningLog Entity
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| id | UUID | Unique identifier | Auto-generated |
| created_by_user_id | UUID | User who created the log | Yes |
| log_type | String | Type: "planning" or "diary" | Yes |
| entity | String | Entity type | Yes |
| entity_id | UUID | Associated entity ID | Yes |
| interval_type | String | Time interval type | Yes |
| interval_type_id | String | Formatted interval ID | Yes |
| title | String | Log title | Yes |
| description | String | Optional description | No |
| content | Text | HTML content (stored as `content`, exposed as `content_html`) | Yes |
| subject_id | UUID | Associated subject | Yes |
| comma_separated_file_ids | String | Comma-separated file UUIDs | No |
| status | String | "ACTIVE" or "DELETED" | Default: "ACTIVE" |
| institute_id | UUID | Institute ID | Yes |
| created_at | Timestamp | Creation timestamp | Auto-generated |
| updated_at | Timestamp | Last update timestamp | Auto-updated |

---

## Caching Strategy

### Server-Side Caching
- **Cache Name:** `planningLogsList`
- **Cache Key:** `{instituteId}-{pageNo}-{pageSize}-{filterHashCode}`
- **Eviction:** Automatic on create/update operations
- **Benefits:** Reduces database load, improves response time

### Cache Invalidation
All cached list responses are cleared when:
- New logs are created (`POST /create`)
- Existing logs are updated (`PATCH /{logId}`)

---

## Validation Rules

### interval_type_id Format

The format depends on the `interval_type`:

**Daily** (`interval_type: "daily"`):
- Pattern: `^\d{4}-\d{2}-\d{2}$`
- Format: YYYY-MM-DD (ISO date)
- Examples:
  - ✅ `2024-11-26` (November 26, 2024)
  - ✅ `2025-01-15` (January 15, 2025)


**Weekly** (`interval_type: "weekly"`):
- Pattern: `^\d{4}_D0[1-7]$`
- Format: YYYY_D0X (day of week, 1=Monday, 7=Sunday)
- Examples:
  - ✅ `2024_D01` (Monday)
  - ✅ `2024_D05` (Friday)


**Monthly** (`interval_type: "monthly"`):
- Pattern: `^\d{4}_\d{2}_W0[1-5]$`
- Format: YYYY_MM_W0X (week of specific month, 1-5)
- Examples:
  - ✅ `2024_01_W01` (Week 1 of January 2024)
  - ✅ `2024_03_W03` (Week 3 of March 2024)

**Yearly Month** (`interval_type: "yearly_month"`):
- Pattern: `^\d{4}_M(0[1-9]|1[0-2])$`
- Format: YYYY_MXX (month of year, 01-12)
- Examples:
  - ✅ `2024_M01` (January)
  - ✅ `2024_M12` (December)
 

**Yearly Quarter** (`interval_type: "yearly_quarter"`):
- Pattern: `^\d{4}_Q0[1-4]$`
- Format: YYYY_Q0X (quarter, 1-4)
- Examples:
  - ✅ `2024_Q01` (Q1)
  - ✅ `2024_Q04` (Q4)


### Required Fields (Create)
- `log_type`
- `entity`
- `entity_id`
- `interval_type`
- `interval_type_id`
- `title`
- `content_html`
- `subject_id`

### Optional Fields (Create)
- `description`
- `comma_separated_file_ids`

---

## Notes

1. **Soft Delete:** Logs are never physically deleted. Set `status` to `"DELETED"` to mark as deleted.

2. **Permission Model:** Only the creator of a log can update it. Admins cannot update logs created by other users.

3. **Pagination:** Default page size is 20. Maximum recommended page size is 100.

4. **Filter Arrays:** Empty strings in filter arrays are ignored. Arrays with only empty strings are treated as no filter.

5. **Content Field:** The database stores content in a field named `content`, but the API exposes it as `content_html` for clarity.

6. **Timestamps:** All timestamps are in ISO 8601 format and use the server's timezone.

7. **File Attachments:** Files must be uploaded separately using the System Files API. Only file IDs are stored with planning logs.
