# Tag Management System API Documentation

## Overview
The Tag Management System allows institutes to create and manage tags for their users. It supports both institute-specific tags and system-wide default tags. Users can be tagged individually or in bulk via CSV upload.

## Features
- ✅ Create institute-specific tags
- ✅ Access system-wide default tags
- ✅ Tag users individually or in bulk
- ✅ CSV upload for bulk user tagging
- ✅ Deactivate user tags
- ✅ Tag statistics and reporting
- ✅ Prevent duplicate tag assignments
- ✅ Automatic tag reactivation for previously inactive tags

## Database Schema

### Tags Table
```sql
CREATE TABLE public.tags (
    id varchar(255) NOT NULL PRIMARY KEY,
    tag_name varchar(255) NOT NULL,
    institute_id varchar(255) NULL, -- NULL for default/system tags
    description text NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id varchar(255) NULL,
    status varchar(255) DEFAULT 'ACTIVE' NOT NULL
);
```

### User Tags Table
```sql
CREATE TABLE public.user_tags (
    id varchar(255) NOT NULL PRIMARY KEY,
    user_id varchar(255) NOT NULL,
    tag_id varchar(255) NOT NULL,
    institute_id varchar(255) NOT NULL,
    status varchar(255) DEFAULT 'ACTIVE' NOT NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id varchar(255) NULL,
    CONSTRAINT fk_user_tags_tag_id FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
```

## API Endpoints

### Base URL
```
/admin-core-service/tag-management
```

---

## Tag Management APIs

### 1. Create Tag
Create a new tag for the institute.

**Endpoint:** `POST /institutes/{instituteId}/tags`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
    "tagName": "VIP Student",
    "description": "Students with VIP access privileges"
}
```

**Response:**
```json
{
    "id": "tag-uuid-123",
    "tagName": "VIP Student",
    "instituteId": "institute-123",
    "description": "Students with VIP access privileges",
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "createdByUserId": "user-456",
    "defaultTag": false
}
```

**cURL Example:**
```bash
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tagName": "VIP Student",
    "description": "Students with VIP access privileges"
  }'
```

---

### 2. Get All Tags
Get all tags available for the institute (including default tags).

**Endpoint:** `GET /institutes/{instituteId}/tags`

**Response:**
```json
[
    {
        "id": "tag-uuid-123",
        "tagName": "VIP Student",
        "instituteId": "institute-123",
        "description": "Students with VIP access privileges",
        "status": "ACTIVE",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z",
        "createdByUserId": "user-456",
        "defaultTag": false
    },
    {
        "id": "tag-uuid-456",
        "tagName": "Premium",
        "instituteId": null,
        "description": "Premium users across all institutes",
        "status": "ACTIVE",
        "createdAt": "2024-01-10T08:00:00Z",
        "updatedAt": "2024-01-10T08:00:00Z",
        "createdByUserId": "system",
        "defaultTag": true
    }
]
```

**cURL Example:**
```bash
curl -X GET "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 3. Get Default Tags Only
Get only system-wide default tags.

**Endpoint:** `GET /tags/default`

**cURL Example:**
```bash
curl -X GET "https://api.vacademy.io/admin-core-service/tag-management/tags/default" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4. Get Institute Tags Only
Get only institute-specific tags.

**Endpoint:** `GET /institutes/{instituteId}/tags/institute`

**cURL Example:**
```bash
curl -X GET "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags/institute" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 5. Delete Tag
Delete (mark as inactive) a tag. Only non-default tags can be deleted.

**Endpoint:** `DELETE /institutes/{instituteId}/tags/{tagId}`

**Response:**
```json
"Tag deleted successfully"
```

**cURL Example:**
```bash
curl -X DELETE "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags/tag-uuid-123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 6. Get Tag Statistics
Get usage statistics for all tags in the institute.

**Endpoint:** `GET /institutes/{instituteId}/tags/statistics`

**Response:**
```json
[
    {
        "tagId": "tag-uuid-123",
        "tagName": "VIP Student",
        "userCount": 25
    },
    {
        "tagId": "tag-uuid-456",
        "tagName": "Premium",
        "userCount": 150
    }
]
```

**cURL Example:**
```bash
curl -X GET "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags/statistics" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## User Tag Management APIs

### 7. Get User Tags
Get all tags (active and inactive) for a specific user.

**Endpoint:** `GET /institutes/{instituteId}/users/{userId}/tags`

**Response:**
```json
{
    "userId": "user-789",
    "activeTags": [
        {
            "id": "tag-uuid-123",
            "tagName": "VIP Student",
            "instituteId": "institute-123",
            "description": "Students with VIP access privileges",
            "status": "ACTIVE",
            "defaultTag": false
        }
    ],
    "inactiveTags": [
        {
            "id": "tag-uuid-789",
            "tagName": "Former Premium",
            "instituteId": "institute-123",
            "description": "Previously premium users",
            "status": "INACTIVE",
            "defaultTag": false
        }
    ],
    "totalTagCount": 2
}
```

**cURL Example:**
```bash
curl -X GET "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/users/user-789/tags" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 8. Get Active User Tags
Get only active tags for a specific user.

**Endpoint:** `GET /institutes/{instituteId}/users/{userId}/tags/active`

**cURL Example:**
```bash
curl -X GET "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/users/user-789/tags/active" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 9. Get Active Tags for Multiple Users
Get active tags for multiple users in a single request.

**Endpoint:** `POST /institutes/{instituteId}/users/tags/active`

**Request Body:**
```json
["user-789", "user-101", "user-102"]
```

**Response:**
```json
{
    "user-789": [
        {
            "id": "tag-uuid-123",
            "tagName": "VIP Student",
            "defaultTag": false
        }
    ],
    "user-101": [
        {
            "id": "tag-uuid-456",
            "tagName": "Premium",
            "defaultTag": true
        }
    ],
    "user-102": []
}
```

**cURL Example:**
```bash
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/users/tags/active" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '["user-789", "user-101", "user-102"]'
```

---

### 10. Add Tags to Users
Add multiple tags to multiple users in a single request.

**Endpoint:** `POST /users/tags/add`

**Request Body:**
```json
{
    "userIds": ["user-789", "user-101", "user-102"],
    "tagIds": ["tag-uuid-123", "tag-uuid-456"]
}
```

**Response:**
```json
{
    "totalProcessed": 6,
    "successCount": 4,
    "skipCount": 2,
    "errorCount": 0,
    "errors": [],
    "userErrors": {}
}
```

**cURL Example:**
```bash
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/users/tags/add" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userIds": ["user-789", "user-101", "user-102"],
    "tagIds": ["tag-uuid-123", "tag-uuid-456"]
  }'
```

---

### 11. Add Single Tag to Multiple Users
Add a single tag to multiple users.

**Endpoint:** `POST /tags/{tagId}/users/add`

**Request Body:**
```json
["user-789", "user-101", "user-102"]
```

**Response:**
```json
{
    "totalProcessed": 3,
    "successCount": 2,
    "skipCount": 1,
    "errorCount": 0,
    "errors": [],
    "userErrors": {}
}
```

**cURL Example:**
```bash
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/tags/tag-uuid-123/users/add" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '["user-789", "user-101", "user-102"]'
```

---

### 12. Deactivate User Tags
Make user tags inactive for specific users.

**Endpoint:** `POST /users/tags/deactivate`

**Query Parameters:**
- `userIds`: List of user IDs
- `tagIds`: List of tag IDs

**Response:**
```json
{
    "totalProcessed": 6,
    "successCount": 4,
    "skipCount": 2,
    "errorCount": 0,
    "errors": [],
    "userErrors": {}
}
```

**cURL Example:**
```bash
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/users/tags/deactivate?userIds=user-789,user-101&tagIds=tag-uuid-123,tag-uuid-456" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## CSV Upload APIs

### 13. Upload CSV and Add Tag
Upload a CSV file with user IDs and add a specific tag to all users in the file.

**Endpoint:** `POST /tags/{tagId}/users/csv-upload`

**Headers:**
- `Content-Type: multipart/form-data`
- `Authorization: Bearer <token>`

**Form Data:**
- `file`: CSV file with user IDs

**CSV Format:**
```csv
user_id
user-123
user-456
user-789
```

**Response:**
```json
{
    "totalProcessed": 3,
    "successCount": 2,
    "skipCount": 1,
    "errorCount": 0,
    "errors": [],
    "userErrors": {}
}
```

**cURL Example:**
```bash
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/tags/tag-uuid-123/users/csv-upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@users.csv"
```

---

### 14. Validate CSV File
Validate CSV file format before processing.

**Endpoint:** `POST /csv/validate`

**Response:**
```json
"CSV file format is valid"
```

**cURL Example:**
```bash
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/csv/validate" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@users.csv"
```

---

### 15. Download CSV Template
Download a sample CSV template file.

**Endpoint:** `GET /csv/template`

**Response:**
```csv
user_id
user123
user456
user789
```

**cURL Example:**
```bash
curl -X GET "https://api.vacademy.io/admin-core-service/tag-management/csv/template" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o "user_tags_template.csv"
```

---

## Health Check

### 16. Health Check
Check if the tag management service is running.

**Endpoint:** `GET /health`

**Response:**
```json
{
    "status": "UP",
    "service": "Tag Management Service",
    "timestamp": "1705312345678"
}
```

**cURL Example:**
```bash
curl -X GET "https://api.vacademy.io/admin-core-service/tag-management/health"
```

---

## Error Responses

### Common Error Formats

**400 Bad Request:**
```json
{
    "error": "Bad Request",
    "message": "Tag with name 'VIP Student' already exists for this institute",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

**404 Not Found:**
```json
{
    "error": "Not Found",
    "message": "Tag not found or not accessible",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

**403 Forbidden:**
```json
{
    "error": "Forbidden",
    "message": "Default tags cannot be deleted",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Business Rules

### Tag Management
1. **Tag Names**: Must be unique per institute (including default tags)
2. **Default Tags**: Cannot be deleted or modified by institute admins
3. **Tag Status**: Tags can be ACTIVE, INACTIVE, or DELETED
4. **Institute Scope**: Each institute can only access their own tags + default tags

### User Tag Assignment
1. **Duplicate Prevention**: Same user cannot have the same active tag twice
2. **Reactivation**: If a user has an inactive tag, adding it again will reactivate it
3. **Institute Isolation**: User tags are isolated per institute
4. **Status Management**: User tags can be ACTIVE or INACTIVE

### CSV Upload
1. **File Format**: Only CSV files are accepted
2. **Column Format**: Single column with user_id values
3. **Header Detection**: Automatically detects and skips header rows
4. **Duplicate Handling**: Automatically removes duplicate user IDs
5. **Error Handling**: Continues processing even if some user IDs fail

---

## Frontend Integration Guide

### Tag Selection Component
```javascript
// Get all available tags
const tags = await fetch('/admin-core-service/tag-management/tags')
  .then(res => res.json());

// Separate default and institute tags
const defaultTags = tags.filter(tag => tag.defaultTag);
const instituteTags = tags.filter(tag => !tag.defaultTag);
```

### User Tag Management
```javascript
// Get user's current tags
const userTags = await fetch(`/admin-core-service/tag-management/users/${userId}/tags`)
  .then(res => res.json());

// Add tags to user
const result = await fetch('/admin-core-service/tag-management/users/tags/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userIds: [userId],
    tagIds: selectedTagIds
  })
}).then(res => res.json());
```

### CSV Upload Component
```javascript
// Upload CSV file
const formData = new FormData();
formData.append('file', csvFile);

const result = await fetch(`/admin-core-service/tag-management/tags/${tagId}/users/csv-upload`, {
  method: 'POST',
  body: formData
}).then(res => res.json());

// Display results
console.log(`Success: ${result.successCount}, Skip: ${result.skipCount}, Error: ${result.errorCount}`);
```

---

## Testing Scenarios

### Happy Path
1. Create a new tag
2. Add tag to multiple users
3. Verify users have the tag
4. Upload CSV with more users
5. Check tag statistics

### Edge Cases
1. Try to create duplicate tag name
2. Try to delete default tag
3. Add same tag to user twice (should skip)
4. Upload empty CSV file
5. Upload CSV with invalid user IDs

### Error Handling
1. Invalid tag ID in requests
2. Malformed CSV files
3. Network timeouts during bulk operations
4. Unauthorized access attempts
