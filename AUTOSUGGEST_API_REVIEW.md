# User Autosuggest API Review

## Overview

This document reviews the newly implemented API for autosuggesting users within an institute. The API is designed to support searching by name, email, or phone number, with optional role filtering.

## API Specification

### Endpoint

`GET /auth-service/v1/user/autosuggest-users`

### Query Parameters

| Parameter     | Type           | Required | Description                                                                                                                                           |
| :------------ | :------------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `instituteId` | `String`       | **Yes**  | The ID of the institute to search within.                                                                                                             |
| `query`       | `String`       | **Yes**  | The search string. Matches against `full_name` (case-insensitive), `email` (case-insensitive), or `mobile_number`.                                    |
| `roles`       | `List<String>` | No       | A comma-separated list of role names (e.g., `STUDENT,TEACHER`) to filter the results. If omitted, searches through all active users in the institute. |

### Response

Returns a list of `UserDTO` objects. The list is limited to **10 results**, ordered by `full_name` ascending.

**Response Body Example:**

```json
[
  {
    "id": "user-uuid-1",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "fullName": "John Doe",
    "mobileNumber": "1234567890",
    "roles": [...]
    // ... other user fields
  },
  // ... up to 9 more
]
```

## Implementation Details

### Repository Layer (`UserRepository.java`)

A native SQL query `autoSuggestUsers` was added:

```sql
SELECT DISTINCT u.* FROM users u
JOIN user_role ur ON u.id = ur.user_id
JOIN roles r ON r.id = ur.role_id
WHERE ur.status = 'ACTIVE'
  AND ur.institute_id = :instituteId
  AND (:roleNames IS NULL OR r.role_name IN (:roleNames))
  AND (
      (:query IS NULL OR LOWER(u.full_name) LIKE LOWER(CONCAT('%', :query, '%'))) OR
      (:query IS NULL OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))) OR
      (:query IS NULL OR u.mobile_number LIKE CONCAT('%', :query, '%'))
  )
ORDER BY u.full_name ASC
LIMIT 10
```

**Key Logic:**

- **Case-Insensitivity**: Uses `LOWER()` for name and email comparisons.
- **Role Filtering**: The `(:roleNames IS NULL OR ...)` clause allows the roles parameter to be optional.
- **Institute Scope**: Strictly limits results to the provided `instituteId`.
- **Active Users**: Only includes users with `ACTIVE` role status in the institute.
- **Performance**: Limits results to 10 to ensure quick response times for type-ahead/autosuggest features.

## usage Examples

### 1. Search for a student by name

`GET /auth-service/v1/user/autosuggest-users?instituteId=inst-123&query=John&roles=STUDENT`

### 2. Search for any user by email

`GET /auth-service/v1/user/autosuggest-users?instituteId=inst-123&query=gmail.com`

### 3. Search for staff by phone number part

`GET /auth-service/v1/user/autosuggest-users?instituteId=inst-123&query=9876&roles=TEACHER,ADMIN`

## Recommendations / Future Improvements

- **Indexing**: Ensure that `full_name`, `email`, and `mobile_number` have appropriate indexes if the `users` table grows significantly large, although leading wildcard searches (`%query%`) generally can't use standard B-tree indexes efficiently. For large datasets, a dedicated search solution (e.g., Elasticsearch or Postgres Full Text Search) might be needed.
- **Validation**: Ensure `instituteId` is validated to belong to the authenticated user's authorized scope if strict multi-tenancy enforcement is needed at the gateway or filter level.
