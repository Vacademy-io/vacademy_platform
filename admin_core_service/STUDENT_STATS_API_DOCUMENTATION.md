# Student Stats API - Complete Documentation

## 📋 Overview

The Student Stats API classifies students as **NEW_USER** or **RETAINER** based on their enrollment history and returns:
- ✅ ONE ROW PER USER (using GROUP BY)
- ✅ **ARRAY** of `package_session_ids` for users enrolled in multiple sessions
- ✅ Database-level pagination
- ✅ User classification based on previous enrollments
- ✅ Enriched with user details from auth service

---

## 🚀 API Endpoint

```
POST /admin-core-service/institute/institute_learner/stats/users?pageNo=0&pageSize=20
```

**Authentication**: Bearer Token Required  
**Content-Type**: `application/json`

---

## 📊 Classification Logic

### NEW_USER
User has **NO** active enrollment **BEFORE** `start_date_in_utc` for the institute.

### RETAINER
User has **at least ONE** active enrollment **BEFORE** `start_date_in_utc` for the institute.

**SQL Logic:**
```sql
LEFT JOIN student_session_institute_group_mapping prev
    ON prev.user_id = curr.user_id
    AND prev.institute_id = :instituteId
    AND prev.status = 'ACTIVE'
    AND prev.created_at < :startDate  -- Key condition

CASE 
    WHEN prev.user_id IS NOT NULL THEN 'RETAINER'
    ELSE 'NEW_USER'
END
```

---

## 📥 Request Structure

### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `pageNo` | Integer | No | 0 | Page number (0-indexed) |
| `pageSize` | Integer | No | 20 | Records per page |

### Request Body: StudentStatsFilter

```json
{
  "institute_id": "inst-uuid-123",
  "package_session_ids": ["ps-uuid-1", "ps-uuid-2"],
  "user_types": ["NEW_USER", "RETAINER"],
  "start_date_in_utc": "2024-01-01T00:00:00.000Z",
  "end_date_in_utc": "2024-12-31T23:59:59.999Z",
  "search_name": "john",
  "sort_columns": {
    "created_at": "DESC"
  }
}
```

### Field Details

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `institute_id` | String | ✅ Yes | Institute identifier |
| `package_session_ids` | List<String> | ❌ No | Filter by package sessions. **Empty/null = ALL packages** |
| `user_types` | List<String> | ❌ No | Filter by `NEW_USER`, `RETAINER`. **Empty/null = BOTH types** |
| `start_date_in_utc` | Date (ISO 8601) | ✅ Yes | Start date for enrollment range |
| `end_date_in_utc` | Date (ISO 8601) | ✅ Yes | End date for enrollment range |
| `search_name` | String | ❌ No | **NOT IMPLEMENTED YET** - For future global search |
| `sort_columns` | Map<String, String> | ❌ No | Sorting: `{"field": "ASC/DESC"}` |

### 🔍 Filters Applied Automatically
- ✅ `status = 'ACTIVE'` (only active enrollments)
- ✅ `created_at BETWEEN start_date_in_utc AND end_date_in_utc`
- ✅ `institute_id = <provided value>`

---

## 📤 Response Structure

### Success Response (200 OK)

```json
{
  "content": [
    {
      "user_type": "NEW_USER",
      "user_dto": {
        "id": "user-uuid-001",
        "username": "john.doe",
        "email": "john@example.com",
        "full_name": "John Doe",
        "mobile_number": "+1234567890"
      },
      "package_session_ids": ["ps-uuid-1", "ps-uuid-2"],
      "comma_separated_org_roles": "STUDENT,LEARNER",
      "created_at": "2024-03-15T10:30:00.000Z",
      "start_date": "2024-01-01T00:00:00.000Z",
      "end_date": "2024-12-31T23:59:59.999Z"
    }
  ],
  "page_no": 0,
  "page_size": 20,
  "total_elements": 150,
  "total_pages": 8,
  "last": false
}
```

### Response Fields

**AllStudentStatsResponse**
| Field | Type | Description |
|-------|------|-------------|
| `content` | Array<StudentStatsDTO> | List of student records |
| `page_no` | Integer | Current page (0-indexed) |
| `page_size` | Integer | Records per page |
| `total_elements` | Long | Total matching records |
| `total_pages` | Integer | Total pages |
| `last` | Boolean | Is this the last page? |

**StudentStatsDTO**
| Field | Type | Description |
|-------|------|-------------|
| `user_type` | String | `"NEW_USER"` or `"RETAINER"` |
| `user_dto` | UserDTO | Complete user details from auth service |
| `package_session_ids` | List<String> | **ARRAY** of all package sessions |
| `comma_separated_org_roles` | String | User's organization roles |
| `created_at` | Date | Enrollment creation timestamp |
| `start_date` | Date | Request start date (for reference) |
| `end_date` | Date | Request end date (for reference) |

---

## 💻 Implementation Details

### File Structure
```
admin_core_service/src/main/java/.../institute_learner/
├── controller/
│   └── StudentStatsController.java
├── manager/
│   └── StudentStatsManager.java
├── repository/
│   └── StudentSessionRepository.java (method: findUserStatsWithTypePaginated)
└── dto/student_stats_dto/
    ├── UserTypeEnum.java
    ├── StudentStatsFilter.java
    ├── StudentStatsDTO.java
    └── AllStudentStatsResponse.java
```

### Repository Query (StudentSessionRepository.java)

**Method Signature:**
```java
Page<Object[]> findUserStatsWithTypePaginated(
    @Param("instituteId") String instituteId,
    @Param("startDate") Date startDate,
    @Param("endDate") Date endDate,
    @Param("packageSessionIds") List<String> packageSessionIds,
    @Param("packageSessionSize") int packageSessionSize,
    @Param("userTypes") List<String> userTypes,
    @Param("userTypeSize") int userTypeSize,
    Pageable pageable
);
```

**SQL Query:**
```sql
WITH user_mappings AS (
    SELECT 
        curr.user_id,
        ARRAY_AGG(DISTINCT curr.package_session_id) AS package_session_ids,
        MAX(curr.comma_separated_org_roles) AS comma_separated_org_roles,
        MIN(curr.created_at) AS created_at,
        CASE 
            WHEN MAX(CASE WHEN prev.user_id IS NOT NULL THEN 1 ELSE 0 END) = 1 
            THEN 'RETAINER'
            ELSE 'NEW_USER'
        END AS user_type
    FROM student_session_institute_group_mapping curr
    LEFT JOIN student_session_institute_group_mapping prev
        ON prev.user_id = curr.user_id
        AND prev.institute_id = :instituteId
        AND prev.status = 'ACTIVE'
        AND prev.created_at < :startDate
    WHERE curr.institute_id = :instituteId
        AND curr.status = 'ACTIVE'
        AND curr.created_at BETWEEN :startDate AND :endDate
        AND (:packageSessionSize = 0 OR curr.package_session_id IN (:packageSessionIds))
    GROUP BY curr.user_id
)
SELECT 
    um.user_id,
    um.user_type,
    um.package_session_ids,
    um.comma_separated_org_roles,
    um.created_at
FROM user_mappings um
WHERE (:userTypeSize = 0 OR um.user_type IN (:userTypes))
```

**Query Returns:** `Page<Object[]>`
- Index 0: `user_id` (String)
- Index 1: `user_type` (String)
- Index 2: `package_session_ids` (PostgreSQL Array)
- Index 3: `comma_separated_org_roles` (String)
- Index 4: `created_at` (Timestamp)

### Manager Processing Flow (StudentStatsManager.java)

1. Create `Pageable` with sorting
2. Call repository with filters
3. Handle empty results
4. Process each `Object[]` row:
    - Extract user_id, user_type
    - **Convert PostgreSQL array** to `List<String>`
    - Build `StudentStatsDTO`
5. Batch fetch user details from auth service
6. Enrich DTOs with `UserDTO`
7. Return paginated response

**PostgreSQL Array Conversion:**
```java
if (packageSessionIdsObj instanceof java.sql.Array) {
    Object[] arr = (Object[]) ((java.sql.Array) packageSessionIdsObj).getArray();
    for (Object item : arr) {
        packageSessionIds.add(item.toString());
    }
}
```

---

## ⚠️ Known Issues

### ❌ Issue 1: Method Name Mismatch
**Problem:** Manager calls `statsFilter.getStartDate()` and `statsFilter.getEndDate()` but filter has `startDateInUtc` and `endDateInUtc`.

**Location:** `StudentStatsManager.java` lines 46-47, 109-110

**Current (WRONG):**
```java
statsFilter.getStartDate()  // Method doesn't exist
statsFilter.getEndDate()    // Method doesn't exist
```

**Filter Has:**
```java
private Date startDateInUtc;  
private Date endDateInUtc;
```

**Fix Options:**
- **Option A:** Change manager to call `getStartDateInUtc()` / `getEndDateInUtc()`
- **Option B:** Change filter fields to `startDate` / `endDate`

### ❌ Issue 2: searchName Not Implemented
**Problem:** `searchName` field exists in filter but:
1. Repository method doesn't have `searchName` parameter
2. SQL query doesn't filter by searchName
3. Manager passes searchName but repository ignores it

**Current State:**
- Manager passes: `statsFilter.getSearchName()`
- Repository expects: **8 parameters** (no searchName)
- SQL query: **No searchName filtering**

**To Implement:**
1. Add `@Param("searchName") String searchName` to repository
2. Add LEFT JOIN with `institute_student` table
3. Add WHERE clause with ILIKE search across: name, email, mobile, username, enrollment number

---

## 📝 Example Requests

### Example 1: Get All Students (NEW_USER + RETAINER)
```bash
curl -X POST 'http://localhost:8080/admin-core-service/institute/institute_learner/stats/users?pageNo=0&pageSize=20' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_TOKEN' \
-d '{
  "institute_id": "inst-123",
  "start_date_in_utc": "2024-01-01T00:00:00.000Z",
  "end_date_in_utc": "2024-12-31T23:59:59.999Z"
}'
```

### Example 2: Get Only NEW_USER
```bash
curl -X POST 'http://localhost:8080/admin-core-service/institute/institute_learner/stats/users?pageNo=0&pageSize=20' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_TOKEN' \
-d '{
  "institute_id": "inst-123",
  "user_types": ["NEW_USER"],
  "start_date_in_utc": "2024-01-01T00:00:00.000Z",
  "end_date_in_utc": "2024-12-31T23:59:59.999Z",
  "sort_columns": {
    "created_at": "DESC"
  }
}'
```

### Example 3: Get Only RETAINER
```bash
curl -X POST 'http://localhost:8080/admin-core-service/institute/institute_learner/stats/users?pageNo=0&pageSize=20' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_TOKEN' \
-d '{
  "institute_id": "inst-123",
  "user_types": ["RETAINER"],
  "start_date_in_utc": "2024-06-01T00:00:00.000Z",
  "end_date_in_utc": "2024-06-30T23:59:59.999Z"
}'
```

### Example 4: Filter by Package Sessions
```bash
curl -X POST 'http://localhost:8080/admin-core-service/institute/institute_learner/stats/users?pageNo=0&pageSize=50' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_TOKEN' \
-d '{
  "institute_id": "inst-123",
  "package_session_ids": ["ps-101", "ps-102"],
  "start_date_in_utc": "2024-03-01T00:00:00.000Z",
  "end_date_in_utc": "2024-03-31T23:59:59.999Z"
}'
```

### Example 5: Combined Filters with Sorting
```bash
curl -X POST 'http://localhost:8080/admin-core-service/institute/institute_learner/stats/users?pageNo=0&pageSize=20' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_TOKEN' \
-d '{
  "institute_id": "inst-123",
  "package_session_ids": ["ps-101"],
  "user_types": ["NEW_USER"],
  "start_date_in_utc": "2024-01-01T00:00:00.000Z",
  "end_date_in_utc": "2024-12-31T23:59:59.999Z",
  "sort_columns": {
    "created_at": "DESC"
  }
}'
```

---

## ⚡ Performance Optimization

### Database-Level
- ✅ **CTE with LEFT JOIN** - Single pass, no correlated subqueries
- ✅ **GROUP BY user_id** - Ensures ONE ROW PER USER
- ✅ **ARRAY_AGG(DISTINCT)** - Aggregates multiple package sessions
- ✅ **Database pagination** - Only fetches requested page
- ✅ **Conditional filtering** - Uses size checks for optional filters

### Application-Level
- ✅ **Batch auth service call** - Single call for all users in page (1 vs N calls)
- ✅ **Efficient array conversion** - Handles PostgreSQL arrays properly
- ✅ **Minimal data transfer** - Only paginated data

### Required Indexes
```sql
CREATE INDEX idx_ssigm_institute_user_status ON student_session_institute_group_mapping(institute_id, user_id, status);
CREATE INDEX idx_ssigm_user_created ON student_session_institute_group_mapping(user_id, created_at);
CREATE INDEX idx_ssigm_package ON student_session_institute_group_mapping(package_session_id);
```

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] Test NEW_USER classification
- [ ] Test RETAINER classification
- [ ] Test multiple package_session_ids array
- [ ] Test empty results
- [ ] Test pagination
- [ ] Test sorting
- [ ] Test filtering

### Integration Tests
- [ ] Test API endpoint with valid data
- [ ] Test with invalid institute_id
- [ ] Test date range edge cases
- [ ] Test with large datasets (10K+ users)
- [ ] Test concurrent requests

---

## 🐛 Troubleshooting

### Issue: "Cannot find method getStartDate()"
**Cause:** Filter has `startDateInUtc` not `startDate`  
**Solution:** Use `getStartDateInUtc()` or rename filter fields

### Issue: Empty results when expecting data
**Check:**
1. Verify date range includes enrollments
2. Check `status = 'ACTIVE'` filter
3. Verify institute_id exists
4. Check if filters are too restrictive

### Issue: Wrong user classification
**Check:**
1. Verify `start_date_in_utc` is correct
2. Check if user has enrollments before start date
3. Verify `status = 'ACTIVE'` on previous enrollments

---

## 📌 Summary

### ✅ What Works
- ONE ROW PER USER (GROUP BY)
- Array of package_session_ids
- NEW_USER vs RETAINER classification
- Database-level pagination
- Auth service integration
- Multiple package sessions per user

### ❌ What Needs Fixing
1. **Method name mismatch**: `getStartDate()` vs `getStartDateInUtc()`
2. **searchName not implemented**: Parameter exists but no SQL filtering

### 📊 Supported Filters
| Filter | Status | Description |
|--------|--------|-------------|
| `institute_id` | ✅ Working | Required filter |
| `package_session_ids` | ✅ Working | Optional, empty = all |
| `user_types` | ✅ Working | Optional, empty = both |
| `start_date_in_utc` | ✅ Working | Required, defines date range |
| `end_date_in_utc` | ✅ Working | Required, defines date range |
| `sort_columns` | ✅ Working | Optional sorting |
---

**Last Updated:** December 5, 2024  
**Status:** ⚠️ Working with 2 known issues  
**API Version:** 1.0.0
