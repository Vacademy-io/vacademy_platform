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

### CSV Upload:
- `POST /institutes/{instituteId}/tags/{tagId}/users/csv-upload` - CSV upload
- `POST /csv/validate` - Validate CSV (unchanged)
- `GET /csv/template` - Get template (unchanged)

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

# CSV upload
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags/tag-uuid-123/users/csv-upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@users.csv"
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
