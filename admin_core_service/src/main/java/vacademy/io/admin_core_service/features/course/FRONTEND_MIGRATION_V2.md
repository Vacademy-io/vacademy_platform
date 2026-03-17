# Frontend Migration Guide: Teacher Courses Detailed API V2

## Endpoint Change

**Old:** `GET /admin-core-service/teacher/course-approval/v1/my-courses/detailed`  
**New:** `GET /admin-core-service/teacher/course-approval/v1/my-courses/detailed/v2`

## Query Parameters

- `page` (required): Page number (0-indexed). Default: 0
- `size` (required): Number of items per page. Default: 20
- `sort` (optional): Sort field and direction. Format: `sort=fieldName,direction`
  - Example: `sort=createdAt,desc` or `sort=courseName,asc`
  - Multiple sorts: `sort=createdAt,desc&sort=courseName,asc`

## Response Format Change

### Old Response (V1)
```json
[
  {
    "courseId": "uuid-123",
    "courseName": "Course Name",
    "relationshipType": "CREATOR",
    ...
  }
]
```

### New Response (V2)
```json
{
  "content": [
    {
      "courseId": "uuid-123",
      "courseName": "Course Name",
      "relationshipType": "CREATOR",
      ...
    }
  ],
  "totalElements": 25,
  "totalPages": 3,
  "number": 0,
  "size": 10,
  "first": true,
  "last": false
}
```

## Migration Steps

1. **Update endpoint URL** to `/my-courses/detailed/v2`
2. **Add pagination parameters**: `?page=0&size=10`
3. **Update response handling**: Access data from `response.content` instead of direct array
4. **Use pagination metadata**: `totalElements`, `totalPages`, `number`, `size` for pagination UI

## Example Request

```javascript
GET /admin-core-service/teacher/course-approval/v1/my-courses/detailed/v2?page=0&size=10&sort=createdAt,desc
```

## Example Response Handling

```javascript
// Old (V1)
const courses = response.data; // Direct array

// New (V2)
const courses = response.data.content; // Array inside Page object
const totalItems = response.data.totalElements;
const totalPages = response.data.totalPages;
const currentPage = response.data.number;
```

## Benefits

- ✅ **Pagination**: Efficient data loading for large datasets
- ✅ **DELETED filter**: Automatically excludes deleted packages
- ✅ **Better error handling**: Proper HTTP status codes
- ✅ **Sorting**: Built-in sorting support

