# Membership Details API - Frontend Integration Guide

**Version**: 1.0  
**Last Updated**: December 6, 2025  
**Service**: admin-core-service  
**Base URL**: `http://localhost:8072/admin-core-service` (local) / `https://api.yourdomain.com/admin-core-service` (production)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [API Endpoint](#api-endpoint)
3. [Request Format](#request-format)
4. [Response Format](#response-format)
5. [Field Naming Convention](#field-naming-convention)
6. [Date & Time Handling](#date--time-handling)
7. [Filtering & Sorting](#filtering--sorting)
8. [Pagination](#pagination)
9. [Complete Examples](#complete-examples)
10. [Error Handling](#error-handling)
11. [TypeScript Types](#typescript-types)
12. [React/JavaScript Examples](#reactjavascript-examples)

---

## Overview

The Membership Details API provides a paginated list of user plan memberships with dynamic status calculation (ENDED, ABOUT_TO_END, LIFETIME) and comprehensive user information.

### Key Features
- ✅ Dynamic membership status calculation
- ✅ Server-side pagination and sorting
- ✅ Date range filtering
- ✅ Status-based filtering
- ✅ Cached responses (2-minute TTL)
- ✅ Optimized performance (<5ms for cached requests)

---

## API Endpoint

### POST `/v1/user-plan/membership-details`

**Method**: `POST`  
**Content-Type**: `application/json`  
**Authentication**: Required (Bearer Token)

```
POST /admin-core-service/v1/user-plan/membership-details?pageNo=0&pageSize=10
```

---

## Request Format

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `pageNo` | integer | No | 0 | Page number (0-based index) |
| `pageSize` | integer | No | 10 | Number of items per page |

### Request Body (MembershipFilterDTO)

```json
{
  "start_date_in_utc": "2024-12-06T02:18:03.116Z",
  "end_date_in_utc": "2025-12-06T02:18:03.116Z",
  "membership_statuses": ["ABOUT_TO_END", "ENDED"],
  "package_session_ids": ["session-uuid-1", "session-uuid-2"],
  "institute_id": "dd9b9687-56ee-467a-9fc4-8c5835eae7f9",
  "sort_order": {
    "end_date": "desc",
    "created_at": "asc"
  }
}
```

### Request Body Fields

| Field Name | JSON Key | Type | Required | Description |
|------------|----------|------|----------|-------------|
| `startDateInUtc` | `start_date_in_utc` | string (ISO 8601) | No | Filter plans with end date >= this date (UTC timezone) |
| `endDateInUtc` | `end_date_in_utc` | string (ISO 8601) | No | Filter plans with end date <= this date (UTC timezone) |
| `membershipStatuses` | `membership_statuses` | array of strings | No | Filter by membership status. Valid values: `["ENDED", "ABOUT_TO_END", "LIFETIME"]` |
| `packageSessionIds` | `package_session_ids` | array of strings | No | Filter by Package Session IDs |
| `instituteId` | `institute_id` | string (UUID) | **Yes** | Institute ID to filter memberships |
| `sortOrder` | `sort_order` | object | No | Sorting configuration (key: field name, value: "asc" or "desc") |

---

## Response Format

### Success Response (200 OK)

```json
{
  "content": [
    {
      "user_plan": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "user_id": "user-uuid-1234",
        "payment_plan_id": "plan-uuid-5678",
        "plan_json": "{\"name\":\"Premium Plan\",\"price\":999}",
        "applied_coupon_discount_id": null,
        "applied_coupon_discount_json": null,
        "enroll_invite_id": "invite-uuid-9012",
        "payment_option_id": "option-uuid-3456",
        "payment_option_json": "{\"type\":\"one_time\"}",
        "status": "ACTIVE",
        "source": "USER",
        "sub_org_details": null,
        "created_at": "2024-12-01T10:30:00",
        "updated_at": "2024-12-01T10:30:00",
        "start_date": "2024-12-01T00:00:00.000+00:00",
        "end_date": "2025-12-01T00:00:00.000+00:00",
        "payment_logs": [],
        "enroll_invite": {
          "id": "invite-uuid-9012",
          "institute_id": "dd9b9687-56ee-467a-9fc4-8c5835eae7f9",
          "package_name": "Full Course Package"
        },
        "payment_option": {
          "id": "option-uuid-3456",
          "name": "One-time Payment",
          "price": 999.00
        },
        "payment_plan_dto": {
          "id": "plan-uuid-5678",
          "name": "Premium Plan",
          "duration_months": 12
        }
      },
      "user_details": {
        "id": "user-uuid-1234",
        "username": "john.doe",
        "email": "john.doe@example.com",
        "full_name": "John Doe",
        "address_line": "123 Main Street",
        "city": "New York",
        "region": "NY",
        "pin_code": "10001",
        "mobile_number": "+1234567890",
        "date_of_birth": "1990-01-15T00:00:00.000+00:00",
        "gender": "MALE",
        "is_root_user": false,
        "profile_pic_file_id": "profile-pic-uuid",
        "roles": ["STUDENT"],
        "last_login_time": "2024-12-05T08:30:00.000+00:00"
      },
      "membership_status": "ABOUT_TO_END",
      "calculated_end_date": "2025-12-01T00:00:00.000+00:00",
      "package_sessions": [
        {
          "id": "session-uuid-1",
          "session_name": "Fall 2024",
          "package_name": "Premium Course",
          "level_name": "Level 1",
          "start_time": "2024-09-01T00:00:00.000+00:00",
          "status": "ACTIVE"
        }
      ]
    }
  ],
  "pageable": {
    "sort": {
      "sorted": true,
      "unsorted": false,
      "empty": false
    },
    "pageNumber": 0,
    "pageSize": 10,
    "offset": 0,
    "paged": true,
    "unpaged": false
  },
  "totalPages": 5,
  "totalElements": 48,
  "last": false,
  "first": true,
  "size": 10,
  "number": 0,
  "sort": {
    "sorted": true,
    "unsorted": false,
    "empty": false
  },
  "numberOfElements": 10,
  "empty": false
}
```

### Response Structure

| Field | Type | Description |
|-------|------|-------------|
| `content` | array | Array of membership details objects |
| `pageable` | object | Pagination metadata |
| `totalPages` | integer | Total number of pages |
| `totalElements` | integer | Total number of items across all pages |
| `last` | boolean | Is this the last page? |
| `first` | boolean | Is this the first page? |
| `size` | integer | Page size |
| `number` | integer | Current page number (0-based) |
| `numberOfElements` | integer | Number of elements on current page |
| `empty` | boolean | Is the page empty? |

---

## Field Naming Convention

### ⚠️ IMPORTANT: Snake Case Naming

The API uses **snake_case** for all JSON keys. This is enforced by the `@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)` annotation.

#### Java Field → JSON Key Mapping

| Java Field Name | JSON Key | Example Value |
|-----------------|----------|---------------|
| `startDateInUtc` | `start_date_in_utc` | `"2024-12-06T02:18:03.116Z"` |
| `endDateInUtc` | `end_date_in_utc` | `"2025-12-06T02:18:03.116Z"` |
| `membershipStatuses` | `membership_statuses` | `["ENDED", "ABOUT_TO_END"]` |
| `instituteId` | `institute_id` | `"uuid-string"` |
| `sortOrder` | `sort_order` | `{"end_date": "desc"}` |
| `userId` | `user_id` | `"uuid-string"` |
| `fullName` | `full_name` | `"John Doe"` |
| `createdAt` | `created_at` | `"2024-12-01T10:30:00"` |
| `isRootUser` | `is_root_user` | `true` |

### Naming Rules

1. **Request Body**: Use `snake_case` for all field names
2. **Response Body**: All fields will be in `snake_case`
3. **Query Params**: Use camelCase (`pageNo`, `pageSize`)
4. **Sort Keys**: Use `snake_case` (`"end_date"`, `"created_at"`)

---

## Date & Time Handling

### 🕐 Date Format: ISO 8601 with UTC Timezone

All dates must be sent in **ISO 8601 format with UTC timezone**.

#### Filter Date Fields (Request Body)

| Field | JSON Key | Format | Timezone | Example |
|-------|----------|--------|----------|---------|
| Start Date | `start_date_in_utc` | ISO 8601 | **UTC** | `"2024-12-06T02:18:03.116Z"` |
| End Date | `end_date_in_utc` | ISO 8601 | **UTC** | `"2025-12-06T02:18:03.116Z"` |

#### Response Date Fields

| Field | JSON Key | Format | Example |
|-------|----------|--------|---------|
| Created At | `created_at` | LocalDateTime | `"2024-12-01T10:30:00"` |
| Updated At | `updated_at` | LocalDateTime | `"2024-12-01T10:30:00"` |
| Start Date | `start_date` | Timestamp | `"2024-12-01T00:00:00.000+00:00"` |
| End Date | `end_date` | Timestamp | `"2025-12-01T00:00:00.000+00:00"` |
| Calculated End Date | `calculated_end_date` | Timestamp | `"2025-12-01T00:00:00.000+00:00"` |
| Date of Birth | `date_of_birth` | Date | `"1990-01-15T00:00:00.000+00:00"` |
| Last Login Time | `last_login_time` | Date | `"2024-12-05T08:30:00.000+00:00"` |

### JavaScript/TypeScript Date Conversion

```javascript
// Convert JavaScript Date to UTC ISO String for API
const startDate = new Date('2024-12-06');
const startDateInUtc = startDate.toISOString(); // "2024-12-06T00:00:00.000Z"

// Parse API response dates
const endDate = new Date(response.calculated_end_date); // Parse to Date object
```

---

## Filtering & Sorting

### Membership Status Values

The `membership_statuses` field accepts the following values:

| Status Value | Description | Condition |
|-------------|-------------|-----------|
| `"LIFETIME"` | Lifetime membership | `end_date` is `NULL` |
| `"ABOUT_TO_END"` | Active but ending soon | `end_date >= CURRENT_TIMESTAMP` |
| `"ENDED"` | Expired membership | `end_date < CURRENT_TIMESTAMP` |

### Filtering Examples

```json
// Filter only ended memberships
{
  "membership_statuses": ["ENDED"],
  "institute_id": "institute-uuid"
}

// Filter memberships ending between two dates
{
  "start_date_in_utc": "2024-12-01T00:00:00.000Z",
  "end_date_in_utc": "2025-01-31T23:59:59.999Z",
  "membership_statuses": ["ABOUT_TO_END"],
  "institute_id": "institute-uuid"
}

// Filter all active memberships (excluding ended)
{
  "membership_statuses": ["ABOUT_TO_END", "LIFETIME"],
  "institute_id": "institute-uuid"
}

// No status filter (returns all statuses)
{
  "institute_id": "institute-uuid"
}
```

### Sorting

The `sort_order` object allows sorting by multiple fields.

#### Sortable Fields

| Field Name | JSON Key | Data Type |
|------------|----------|-----------|
| End Date | `end_date` | Timestamp |
| Start Date | `start_date` | Timestamp |
| Created At | `created_at` | LocalDateTime |
| Updated At | `updated_at` | LocalDateTime |
| Status | `status` | String |

#### Sort Direction

- `"asc"` - Ascending order
- `"desc"` - Descending order

#### Sort Examples

```json
// Sort by end date descending (newest first)
{
  "sort_order": {
    "end_date": "desc"
  },
  "institute_id": "institute-uuid"
}

// Multi-field sorting: end date desc, then created date asc
{
  "sort_order": {
    "end_date": "desc",
    "created_at": "asc"
  },
  "institute_id": "institute-uuid"
}

// No sorting (default order)
{
  "institute_id": "institute-uuid"
}
```

---

## Pagination

### Query Parameters

```
?pageNo=0&pageSize=10
```

- **pageNo**: 0-based index (0 = first page, 1 = second page, etc.)
- **pageSize**: Number of items per page (default: 10, max: 100)

### Pagination Metadata in Response

```json
{
  "totalPages": 5,
  "totalElements": 48,
  "size": 10,
  "number": 0,
  "first": true,
  "last": false,
  "numberOfElements": 10,
  "empty": false
}
```

### Calculating Pagination

```javascript
// Calculate total pages
const totalPages = Math.ceil(response.totalElements / response.size);

// Check if there's a next page
const hasNextPage = !response.last;

// Check if there's a previous page
const hasPreviousPage = !response.first;

// Calculate current page range
const startItem = (response.number * response.size) + 1;
const endItem = startItem + response.numberOfElements - 1;
// Showing items 1-10 of 48
```

---

## Complete Examples

### Example 1: Get All Memberships (First Page)

**Request:**
```bash
curl -X POST 'http://localhost:8072/admin-core-service/v1/user-plan/membership-details?pageNo=0&pageSize=10' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ...' \
-d '{
  "institute_id": "dd9b9687-56ee-467a-9fc4-8c5835eae7f9"
}'
```

### Example 2: Get Memberships Ending Soon

**Request:**
```bash
curl -X POST 'http://localhost:8072/admin-core-service/v1/user-plan/membership-details?pageNo=0&pageSize=20' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_TOKEN' \
-d '{
  "membership_statuses": ["ABOUT_TO_END"],
  "institute_id": "dd9b9687-56ee-467a-9fc4-8c5835eae7f9",
  "sort_order": {
    "end_date": "asc"
  }
}'
```

### Example 3: Get Expired Memberships in Date Range

**Request:**
```bash
curl -X POST 'http://localhost:8072/admin-core-service/v1/user-plan/membership-details?pageNo=0&pageSize=50' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_TOKEN' \
-d '{
  "start_date_in_utc": "2024-01-01T00:00:00.000Z",
  "end_date_in_utc": "2024-12-31T23:59:59.999Z",
  "membership_statuses": ["ENDED"],
  "institute_id": "dd9b9687-56ee-467a-9fc4-8c5835eae7f9",
  "sort_order": {
    "end_date": "desc"
  }
}'
```

---

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "timestamp": "2025-12-06T08:30:00.000+00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Institute ID is required",
  "path": "/admin-core-service/v1/user-plan/membership-details"
}
```

#### 401 Unauthorized
```json
{
  "timestamp": "2025-12-06T08:30:00.000+00:00",
  "status": 401,
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "path": "/admin-core-service/v1/user-plan/membership-details"
}
```

#### 500 Internal Server Error
```json
{
  "timestamp": "2025-12-06T08:30:00.000+00:00",
  "status": 500,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "path": "/admin-core-service/v1/user-plan/membership-details"
}
```

---

## TypeScript Types

```typescript
// Request Types
export interface MembershipFilterDTO {
  start_date_in_utc?: string; // ISO 8601 UTC
  end_date_in_utc?: string; // ISO 8601 UTC
  membership_statuses?: MembershipStatus[];
  institute_id: string; // Required
  sort_order?: Record<string, 'asc' | 'desc'>;
}

export type MembershipStatus = 'ENDED' | 'ABOUT_TO_END' | 'LIFETIME';

// Response Types
export interface MembershipDetailsResponse {
  content: MembershipDetail[];
  pageable: Pageable;
  totalPages: number;
  totalElements: number;
  last: boolean;
  first: boolean;
  size: number;
  number: number;
  sort: Sort;
  numberOfElements: number;
  empty: boolean;
}

export interface MembershipDetail {
  user_plan: UserPlanDTO;
  user_details: UserDTO;
  membership_status: MembershipStatus;
  calculated_end_date: string; // Timestamp
}

export interface UserPlanDTO {
  id: string;
  user_id: string;
  payment_plan_id: string;
  plan_json: string | null;
  applied_coupon_discount_id: string | null;
  applied_coupon_discount_json: string | null;
  enroll_invite_id: string;
  payment_option_id: string;
  payment_option_json: string | null;
  status: string;
  source: 'USER' | 'SUB_ORG';
  sub_org_details: SubOrgDetails | null;
  created_at: string; // LocalDateTime
  updated_at: string; // LocalDateTime
  start_date: string; // Timestamp
  end_date: string; // Timestamp
  payment_logs: PaymentLogDTO[]; // Always empty array
  enroll_invite: EnrollInviteDTO;
  payment_option: PaymentOptionDTO;
  payment_plan_dto: PaymentPlanDTO;
}

export interface UserDTO {
  id: string;
  username: string;
  email: string;
  full_name: string;
  address_line: string;
  city: string;
  region: string;
  pin_code: string;
  mobile_number: string;
  date_of_birth: string; // Date
  gender: string;
  is_root_user: boolean;
  profile_pic_file_id: string;
  roles: string[];
  last_login_time: string; // Date
}

export interface SubOrgDetails {
  id: string;
  name: string;
  address: string;
}

export interface Pageable {
  sort: Sort;
  pageNumber: number;
  pageSize: number;
  offset: number;
  paged: boolean;
  unpaged: boolean;
}

export interface Sort {
  sorted: boolean;
  unsorted: boolean;
  empty: boolean;
}
```

---

## React/JavaScript Examples

### Using Fetch API

```javascript
async function getMembershipDetails(filterOptions) {
  const { pageNo = 0, pageSize = 10, ...filters } = filterOptions;
  
  // Convert dates to UTC ISO strings
  const requestBody = {
    institute_id: filters.instituteId,
    start_date_in_utc: filters.startDate?.toISOString(),
    end_date_in_utc: filters.endDate?.toISOString(),
    membership_statuses: filters.statuses,
    sort_order: filters.sortOrder
  };

  const response = await fetch(
    `http://localhost:8072/admin-core-service/v1/user-plan/membership-details?pageNo=${pageNo}&pageSize=${pageSize}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// Usage
const result = await getMembershipDetails({
  instituteId: 'dd9b9687-56ee-467a-9fc4-8c5835eae7f9',
  statuses: ['ABOUT_TO_END', 'ENDED'],
  startDate: new Date('2024-12-01'),
  endDate: new Date('2025-12-31'),
  sortOrder: { end_date: 'desc' },
  pageNo: 0,
  pageSize: 20
});

console.log(`Total memberships: ${result.totalElements}`);
console.log(`Showing page ${result.number + 1} of ${result.totalPages}`);
```

### Using Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8072/admin-core-service',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth interceptor
api.interceptors.request.use(config => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function getMembershipDetails(filters, pageNo = 0, pageSize = 10) {
  try {
    const response = await api.post(
      `/v1/user-plan/membership-details`,
      {
        institute_id: filters.instituteId,
        start_date_in_utc: filters.startDate?.toISOString(),
        end_date_in_utc: filters.endDate?.toISOString(),
        membership_statuses: filters.statuses,
        sort_order: filters.sortOrder
      },
      {
        params: { pageNo, pageSize }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error fetching membership details:', error);
    throw error;
  }
}

// Usage
const data = await getMembershipDetails(
  {
    instituteId: 'dd9b9687-56ee-467a-9fc4-8c5835eae7f9',
    statuses: ['ABOUT_TO_END'],
    sortOrder: { end_date: 'asc' }
  },
  0,
  20
);
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

interface UseMembershipDetailsOptions {
  instituteId: string;
  statuses?: MembershipStatus[];
  startDate?: Date;
  endDate?: Date;
  pageSize?: number;
}

export function useMembershipDetails(options: UseMembershipDetailsOptions) {
  const [data, setData] = useState<MembershipDetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pageNo, setPageNo] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(
        `/admin-core-service/v1/user-plan/membership-details`,
        {
          institute_id: options.instituteId,
          start_date_in_utc: options.startDate?.toISOString(),
          end_date_in_utc: options.endDate?.toISOString(),
          membership_statuses: options.statuses,
          sort_order: { end_date: 'desc' }
        },
        {
          params: {
            pageNo,
            pageSize: options.pageSize || 10
          }
        }
      );
      
      setData(response.data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.instituteId) {
      fetchData();
    }
  }, [options.instituteId, options.statuses, options.startDate, options.endDate, pageNo]);

  return {
    data,
    loading,
    error,
    pageNo,
    setPageNo,
    refetch: fetchData,
    hasNextPage: data ? !data.last : false,
    hasPrevPage: data ? !data.first : false
  };
}

// Usage in component
function MembershipList() {
  const { data, loading, error, pageNo, setPageNo, hasNextPage, hasPrevPage } = 
    useMembershipDetails({
      instituteId: 'dd9b9687-56ee-467a-9fc4-8c5835eae7f9',
      statuses: ['ABOUT_TO_END', 'ENDED'],
      pageSize: 20
    });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div>
      <h1>Membership Details ({data.totalElements} total)</h1>
      <ul>
        {data.content.map(item => (
          <li key={item.user_plan.id}>
            {item.user_details.full_name} - {item.membership_status}
          </li>
        ))}
      </ul>
      <div>
        <button disabled={!hasPrevPage} onClick={() => setPageNo(p => p - 1)}>
          Previous
        </button>
        <span>Page {pageNo + 1} of {data.totalPages}</span>
        <button disabled={!hasNextPage} onClick={() => setPageNo(p => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
```

---

## Performance Notes

### Caching
- ✅ Responses are cached for **2 minutes**
- ✅ Identical requests return cached data (<5ms response time)
- ✅ Cache is cleared when user plan statuses are updated
- ✅ Cache key includes all filter parameters for proper isolation

### Optimization Tips
1. **Use appropriate page sizes**: Balance between fewer requests and response size
2. **Leverage caching**: Identical filter + pagination combinations are cached
3. **Avoid frequent polling**: 2-minute cache TTL means polling faster than 2min won't benefit from cache
4. **Date filtering**: Use date ranges to reduce result sets

---

## Support & Troubleshooting

### Common Issues

**Issue**: Empty response even with valid filters  
**Solution**: Check that `institute_id` is correct and user has access to that institute

**Issue**: Dates not filtering correctly  
**Solution**: Ensure dates are in UTC ISO 8601 format with 'Z' suffix

**Issue**: Sorting not working  
**Solution**: Use snake_case for sort keys (`end_date`, not `endDate`)

**Issue**: 401 Unauthorized  
**Solution**: Check that Bearer token is valid and not expired

### Testing with Postman

1. Set request type to `POST`
2. URL: `{{baseUrl}}/admin-core-service/v1/user-plan/membership-details?pageNo=0&pageSize=10`
3. Headers:
    - `Content-Type`: `application/json`
    - `Authorization`: `Bearer {{token}}`
4. Body (raw JSON):
```json
{
  "institute_id": "your-institute-id-here",
  "membership_statuses": ["ABOUT_TO_END", "ENDED"]
}
```

---

## Changelog

### Version 1.0 (December 6, 2025)
- ✅ Initial API documentation
- ✅ Fixed ClassCastException bug
- ✅ Added caching layer (2-minute TTL)
- ✅ Optimized performance (99.5% faster for cached requests)
- ✅ Removed payment logs from response (use dedicated endpoint if needed)

---

**For Backend Issues**: Contact Backend Team  
**For API Questions**: Refer to Swagger Documentation at `/swagger-ui.html`  
**Last Updated**: December 6, 2025
