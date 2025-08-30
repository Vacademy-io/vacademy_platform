# Updated API Endpoints Summary

## Key Changes Made:
All endpoints now require `instituteId` as a path parameter to support multi-institute users.

## Updated Endpoint Patterns:

### Tag Management:
- `POST /institutes/{instituteId}/tags` - Create tag
- `GET /institutes/{instituteId}/tags` - Get all tags  
- `GET /tags/default` - Get default tags (unchanged)
- `GET /institutes/{instituteId}/tags/institute` - Get institute tags
- `DELETE /institutes/{instituteId}/tags/{tagId}` - Delete tag
- `GET /institutes/{instituteId}/tags/statistics` - Get statistics

### User Tag Management:
- `GET /institutes/{instituteId}/users/{userId}/tags` - Get user tags
- `GET /institutes/{instituteId}/users/{userId}/tags/active` - Get active user tags
- `POST /institutes/{instituteId}/users/tags/active` - Get multiple users' tags
- `POST /institutes/{instituteId}/users/tags/add` - Add tags to users
- `POST /institutes/{instituteId}/tags/{tagId}/users/add` - Add tag to users
- `POST /institutes/{instituteId}/users/tags/deactivate` - Deactivate tags
- `GET /institutes/{instituteId}/tags/{tagId}/users` - Get all users with a specific tag
- `POST /institutes/{instituteId}/tags/users` - Get all users with any of the specified tags
- `POST /institutes/{instituteId}/tags/users/details` - Get detailed user info for users with specified tags
- `POST /institutes/{instituteId}/tags/user-counts` - Get user counts for multiple tags

### CSV Upload:
- `POST /institutes/{instituteId}/tags/{tagId}/users/csv-upload` - CSV upload with user IDs
- `POST /institutes/{instituteId}/tags/{tagId}/users/csv-upload-usernames` - CSV upload with usernames
- `POST /institutes/{instituteId}/tags/by-name/{tagName}/users/csv-upload-usernames` - CSV upload with usernames and tag name
- `POST /csv/validate` - Validate CSV (unchanged)
- `GET /csv/template` - Get user ID template (unchanged)
- `GET /csv/template-usernames` - Get username template

## Sample cURL Commands:

```bash
# Create tag
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"tagName": "VIP Student", "description": "VIP access"}'

# Get all tags for institute
curl -X GET "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get user tags
curl -X GET "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/users/user-789/tags" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Add tags to users
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/users/tags/add" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"userIds": ["user-789", "user-101"], "tagIds": ["tag-uuid-123"]}'

# CSV upload with user IDs
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags/tag-uuid-123/users/csv-upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@users.csv"

# CSV upload with usernames
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags/tag-uuid-123/users/csv-upload-usernames" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@usernames.csv"

# CSV upload with usernames and tag name (auto-creates tag)
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags/by-name/VIP%20Student/users/csv-upload-usernames" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@usernames.csv"

# Get detailed user info for users with specified tags
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags/users/details" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '["tag-uuid-123", "tag-uuid-456"]'

# Get user counts for multiple tags
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags/user-counts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '["tag-uuid-123", "tag-uuid-456", "tag-uuid-789"]'
```

## Sample API Responses

### Get All Tags Response:
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
    "tagName": "Premium Member",
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

### Get Users by Tags Response (User IDs only):
```json
["user-123", "user-456", "user-789", "user-101", "user-102"]
```

### Get User Details by Tags Response:
```json
[
  {
    "userId": "user-123",
    "fullName": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "phoneNumber": "+1234567890",
    "enrollmentId": "ENR001"
  },
  {
    "userId": "user-456",
    "fullName": "Jane Smith",
    "username": "janesmith",
    "email": "jane@example.com",
    "phoneNumber": "+0987654321",
    "enrollmentId": "ENR002"
  },
  {
    "userId": "user-789",
    "fullName": "Bob Johnson",
    "username": "bobjohnson",
    "email": "bob@example.com",
    "phoneNumber": "+1122334455",
    "enrollmentId": "ENR003"
  }
]
```

### Get User Counts by Tags Response:
```json
{
  "tagCounts": {
    "VIP Student": 25,
    "Premium Member": 150,
    "New User": 0
  },
  "totalTags": 3,
  "totalUsers": 175
}
```

### Bulk Tag Operation Response:
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

### Get User Tags Response:
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

### Tag Statistics Response:
```json
[
  {
    "tagId": "tag-uuid-123",
    "tagName": "VIP Student",
    "userCount": 25
  },
  {
    "tagId": "tag-uuid-456",
    "tagName": "Premium Member",
    "userCount": 150
  }
]
```

## CSV Template Formats

### User ID Template (user_tags_template.csv):
```csv
user_id
user123
user456
user789
```

### Username Template (user_tags_usernames_template.csv):
```csv
username
johndoe
janesmith
bobjohnson
```

## Frontend Integration Changes:

```javascript
// OLD: const tags = await fetch('/admin-core-service/tag-management/tags')
// NEW:
const tags = await fetch(`/admin-core-service/tag-management/institutes/${instituteId}/tags`)

// OLD: const userTags = await fetch(`/admin-core-service/tag-management/users/${userId}/tags`)
// NEW:
const userTags = await fetch(`/admin-core-service/tag-management/institutes/${instituteId}/users/${userId}/tags`)
```
