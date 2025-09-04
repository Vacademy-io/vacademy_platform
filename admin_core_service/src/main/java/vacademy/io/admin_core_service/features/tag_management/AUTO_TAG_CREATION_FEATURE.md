# Auto Tag Creation Feature

## Overview
The tag management system now automatically creates tags for institutes when they don't exist during user tagging operations. This eliminates the need to manually create tags before assigning them to users.

## How It Works

### 1. **Existing Tag Operations (Enhanced)**
When adding tags to users via existing endpoints, the system now:
- Checks if the tag exists for the institute
- If not found, automatically creates the tag
- Continues with the user tagging operation

### 2. **New Tag-by-Name Operations**
Added new endpoints that work with tag names instead of IDs:
- Automatically finds existing tags by name
- Creates new tags if they don't exist
- Prefers institute-specific tags over default tags

## Auto-Creation Logic

### For Tag IDs
```java
// When using tag IDs (existing behavior enhanced)
1. Look for tag by ID in institute scope (including default tags)
2. If not found, try to find the source tag by ID globally
3. If source is a default tag → use it directly
4. If source is from another institute → create a copy for current institute
5. If no source found → create basic tag with generated name
```

### For Tag Names
```java
// When using tag names (new feature)
1. Look for existing tag by name in institute scope
2. If found → use existing tag (prefer institute-specific over default)
3. If not found → create new tag with the provided name
```

## New API Endpoints

### Add Tag by Name to Users
```bash
POST /institutes/{instituteId}/tags/by-name/{tagName}/users/add
```

**Example:**
```bash
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags/by-name/VIP%20Student/users/add" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '["user-789", "user-101", "user-102"]'
```

### CSV Upload with Tag Name
```bash
POST /institutes/{instituteId}/tags/by-name/{tagName}/users/csv-upload
```

**Example:**
```bash
curl -X POST "https://api.vacademy.io/admin-core-service/tag-management/institutes/institute-123/tags/by-name/Premium%20Member/users/csv-upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@users.csv"
```

## Benefits

### 1. **Improved User Experience**
- No need to pre-create tags
- Seamless tagging workflow
- Reduces API call complexity

### 2. **Error Reduction**
- Eliminates "tag not found" errors
- Automatic tag management
- Consistent tag naming

### 3. **Flexibility**
- Works with both tag IDs and names
- Supports bulk operations
- CSV upload compatibility

## Usage Examples

### Scenario 1: Tagging with Non-Existent Tag ID
```javascript
// OLD: Would fail if tag doesn't exist
// NEW: Automatically creates tag if possible
const result = await fetch('/admin-core-service/tag-management/institutes/inst-123/users/tags/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userIds: ['user-1', 'user-2'],
    tagIds: ['non-existent-tag-id'] // Will be auto-created
  })
});
```

### Scenario 2: Tagging with Tag Name
```javascript
// NEW: Tag by name - creates if doesn't exist
const result = await fetch('/admin-core-service/tag-management/institutes/inst-123/tags/by-name/VIP Student/users/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(['user-1', 'user-2'])
});
```

### Scenario 3: CSV Upload with Tag Name
```javascript
// NEW: CSV upload with tag name
const formData = new FormData();
formData.append('file', csvFile);

const result = await fetch('/admin-core-service/tag-management/institutes/inst-123/tags/by-name/Premium Member/users/csv-upload', {
  method: 'POST',
  body: formData
});
```

## Auto-Creation Rules

### 1. **Tag Name Uniqueness**
- Tag names must be unique per institute
- System checks existing tags before creation
- Prevents duplicate tag names

### 2. **Default Tag Handling**
- Default tags are used directly (not copied)
- Institute-specific tags take precedence
- Default tags remain system-managed

### 3. **Error Handling**
- Graceful fallback for failed auto-creation
- Detailed error reporting
- Continues processing other tags/users

### 4. **Audit Trail**
- Logs all auto-creation activities
- Tracks created tags and their sources
- Maintains creation metadata

## Response Format

The response includes information about auto-created tags:

```json
{
  "totalProcessed": 6,
  "successCount": 4,
  "skipCount": 2,
  "errorCount": 0,
  "errors": [],
  "userErrors": {},
  "autoCreatedTags": [
    {
      "tagId": "new-tag-uuid",
      "tagName": "VIP Student",
      "action": "created"
    }
  ]
}
```

## Migration Notes

### Existing Code Compatibility
- All existing endpoints continue to work
- Enhanced with auto-creation capability
- No breaking changes

### New Integrations
- Use tag-by-name endpoints for simpler integration
- Leverage auto-creation for dynamic tagging
- Reduce error handling complexity

## Best Practices

### 1. **Use Tag Names for User-Friendly Operations**
```javascript
// Preferred: User-friendly tag names
addTagByName('Premium Member', userIds);

// Still supported: Tag IDs
addTagById('tag-uuid-123', userIds);
```

### 2. **Leverage CSV Upload with Names**
```csv
user_id
user123
user456
```
Upload to: `/institutes/inst-123/tags/by-name/VIP/users/csv-upload`

### 3. **Handle Auto-Creation Results**
```javascript
const result = await addTagsToUsers(request);
if (result.autoCreatedTags?.length > 0) {
  console.log('Auto-created tags:', result.autoCreatedTags);
}
```

## Security Considerations

### 1. **Permission Validation**
- Users must have tag creation permissions
- Institute isolation maintained
- Audit trail for all operations

### 2. **Input Validation**
- Tag names sanitized and validated
- Length and character restrictions enforced
- SQL injection prevention

### 3. **Rate Limiting**
- Auto-creation operations are rate-limited
- Prevents abuse and spam creation
- Monitors bulk operations

This feature significantly improves the usability of the tag management system while maintaining data integrity and security.