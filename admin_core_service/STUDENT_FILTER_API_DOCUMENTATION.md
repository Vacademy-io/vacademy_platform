# Student Filter API Documentation

## Overview
This document describes the V2 student listing API with enhanced filtering capabilities. The V2 endpoint includes 5 new filters in addition to all existing filters.

---

## Endpoints

### V2 Endpoint (Enhanced with New Filters)
**POST** `/admin-core-service/institute/institute_learner/get/v2/all`

### V1 Endpoint (Original - No Changes)
**POST** `/admin-core-service/institute/institute_learner/get/v1/all`

---

## API Safety Analysis ✅

### Changes Made (V2 Only)
1. **Repository Layer**: Added 5 new filter parameters to `getAllStudentV2WithFilterRaw()` and `getAllStudentV2WithSearchRaw()`
2. **Manager Layer**: Updated `fetchStudentPage()` method to pass new filter values from `StudentListFilter` DTO
3. **DTO Layer**: Added 5 new optional `List<String>` fields to `StudentListFilter`

### Why the API Won't Fail
1. ✅ **Backward Compatible**: All new filters are optional (`List<String>` can be null or omitted)
2. ✅ **Null-Safe SQL**: Uses SpEL expressions: `:#{#emails == null || #emails.isEmpty()} = true OR s.email IN (:emails)`
3. ✅ **V1 Unchanged**: Original V1 endpoint remains completely untouched
4. ✅ **Empty List Handling**: PostgreSQL IN clause handled correctly - empty/null filters are ignored
5. ✅ **No Breaking Changes**: Existing API contracts maintained, new fields are additive only
6. ✅ **Type Safety**: All parameters properly typed with `@Param` annotations
7. ✅ **Count Query Sync**: Both main and count queries updated identically

---

## Request Structure

### Query Parameters
- `pageNo` (optional): Page number (default: 0)
- `pageSize` (optional): Number of records per page (default: 10)

### Request Body: StudentListFilter

```json
{
  // Search/Filter
  "name": "string (optional)",
  
  // Existing Filters (V1 & V2)
  "statuses": ["string (optional)"],
  "institute_ids": ["string (required)"],
  "package_session_ids": ["string (optional)"],
  "group_ids": ["string (optional)"],
  "gender": ["string (optional)"],
  "payment_statuses": ["string (optional)"],
  "custom_fields": ["string (optional)"],
  "sources": ["string (optional)"],
  "types": ["string (optional)"],
  "type_ids": ["string (optional)"],
  "destination_package_session_ids": ["string (optional)"],
  "level_ids": ["string (optional)"],
  
  // NEW FILTERS (V2 Only) ⭐
  "usernames": ["string (optional)"],
  "emails": ["string (optional)"],
  "mobile_numbers": ["string (optional)"],
  "regions": ["string (optional)"],
  "sub_org_user_types": ["string (optional)"],
  
  // Sorting
  "sort_columns": {
    "column_name": "ASC or DESC"
  }
}
```

---

## Filter Details

### Existing Filters (Both V1 & V2)

| Filter | Type | Description | Example |
|--------|------|-------------|---------|
| `name` | String | Full-text search on name, username, enrollment number, user_id, mobile | `"john"` |
| `statuses` | List<String> | Student status filter | `["ACTIVE", "INACTIVE"]` |
| `institute_ids` | List<String> | Institute IDs (required) | `["uuid-1", "uuid-2"]` |
| `package_session_ids` | List<String> | Package session IDs | `["pkg-1"]` |
| `group_ids` | List<String> | Group IDs | `["grp-1", "grp-2"]` |
| `gender` | List<String> | Gender filter | `["MALE", "FEMALE"]` |
| `payment_statuses` | List<String> | Payment status filter | `["COMPLETED", "PENDING"]` |
| `custom_fields` | List<String> | Custom field IDs | `["cf-1", "cf-2"]` |
| `sources` | List<String> | Student source filter | `["ORGANIC", "REFERRAL"]` |
| `types` | List<String> | Type filter | `["REGULAR"]` |
| `type_ids` | List<String> | Type ID filter | `["type-1"]` |
| `destination_package_session_ids` | List<String> | Destination package sessions | `["dest-1"]` |
| `level_ids` | List<String> | Level ID filter | `["level-1"]` |

### New Filters (V2 Only) ⭐

| Filter | Type | Matching Type | Description | Example |
|--------|------|---------------|-------------|---------|
| `usernames` | List<String> | **Exact Match** | Filter by exact username(s) | `["john_doe", "jane_smith"]` |
| `emails` | List<String> | **Exact Match** | Filter by exact email address(es) | `["john@example.com"]` |
| `mobile_numbers` | List<String> | **Exact Match** | Filter by exact mobile number(s) | `["+919876543210"]` |
| `regions` | List<String> | **Exact Match** | Filter by exact region/country | `["Maharashtra", "Karnataka"]` |
| `sub_org_user_types` | List<String> | **Exact Set Match** | Filter by exact role set (order-independent) | `["STUDENT", "ADMIN"]` |

### Special Notes on Filters

#### 1. `sub_org_user_types` - Role-Based Filtering
- **Purpose**: Filter students by their exact set of organizational roles
- **Data Source**: `student_session_institute_group_mapping.comma_separated_org_roles`
- **Matching Logic**: Exact array comparison (order-independent)
- **Example**:
  - Student has roles: `"STUDENT,ADMIN"` in database
  - Filter: `["STUDENT", "ADMIN"]` ✅ **MATCHES**
  - Filter: `["ADMIN", "STUDENT"]` ✅ **MATCHES** (order doesn't matter)
  - Filter: `["STUDENT"]` ❌ **NO MATCH** (must have exact set)
  - Filter: `["STUDENT", "ADMIN", "TEACHER"]` ❌ **NO MATCH** (different set)

#### 2. Exact vs Partial Matching
- **`name` field**: Uses partial/fuzzy matching (ILIKE, full-text search)
- **New filters**: Use exact matching (IN clause)
- **Rationale**: Exact matching for specific targeting, partial matching for general search

#### 3. Filter Combination Logic
- All filters use **AND** logic
- Multiple values within a filter use **OR** logic
- Example: `"emails": ["a@x.com", "b@y.com"]` AND `"regions": ["MH"]`
  - Means: (email = a@x.com OR email = b@y.com) AND region = MH

---

## cURL Examples

### 1. Basic Filter - Get All Students by Institute (Works on V1 & V2)

```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/institute_learner/get/v2/all?pageNo=0&pageSize=10" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_ids": ["bd9f2362-84d1-4e01-9762-a5196f9bac80"]
}'
```

---

### 2. Filter by Email (V2 Only - New Feature ⭐)

```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/institute_learner/get/v2/all?pageNo=0&pageSize=10" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_ids": ["bd9f2362-84d1-4e01-9762-a5196f9bac80"],
  "emails": ["shashwatpandit95@gmail.com"]
}'
```

**Use Case**: Find specific student by email for support queries

---

### 3. Filter by Multiple Emails (V2 Only ⭐)

```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/institute_learner/get/v2/all" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_ids": ["bd9f2362-84d1-4e01-9762-a5196f9bac80"],
  "emails": [
    "student1@example.com",
    "student2@example.com",
    "student3@example.com"
  ]
}'
```

**Use Case**: Bulk lookup for specific students (e.g., scholarship candidates)

---

### 4. Filter by Username (V2 Only ⭐)

```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/institute_learner/get/v2/all" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_ids": ["bd9f2362-84d1-4e01-9762-a5196f9bac80"],
  "usernames": ["john_doe_123", "jane_smith_456"]
}'
```

**Use Case**: Admin lookup by username for account management

---

### 5. Filter by Mobile Number (V2 Only ⭐)

```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/institute_learner/get/v2/all" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_ids": ["bd9f2362-84d1-4e01-9762-a5196f9bac80"],
  "mobile_numbers": ["+919876543210", "+918765432109"]
}'
```

**Use Case**: Support team verifying student identity via phone

---

### 6. Filter by Region/Country (V2 Only ⭐)

```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/institute_learner/get/v2/all" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_ids": ["bd9f2362-84d1-4e01-9762-a5196f9bac80"],
  "regions": ["Maharashtra", "Karnataka", "Delhi"]
}'
```

**Use Case**: Regional campaigns, location-based analytics

---

### 7. Filter by Role Types (V2 Only ⭐)

```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/institute_learner/get/v2/all" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_ids": ["bd9f2362-84d1-4e01-9762-a5196f9bac80"],
  "sub_org_user_types": ["STUDENT", "ADMIN"]
}'
```

**Use Case**: Find students who have BOTH STUDENT and ADMIN roles (exact set match)

---

### 8. Combining Old and New Filters (V2 Only)

```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/institute_learner/get/v2/all?pageNo=0&pageSize=20" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_ids": ["bd9f2362-84d1-4e01-9762-a5196f9bac80"],
  "statuses": ["ACTIVE"],
  "gender": ["MALE"],
  "payment_statuses": ["COMPLETED"],
  "regions": ["Maharashtra"],
  "emails": ["student1@example.com", "student2@example.com"]
}'
```

**Use Case**: Highly targeted query - Active male students from Maharashtra with completed payments and specific emails

---

### 9. Search with Name + New Filters (V2 Only)

```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/institute_learner/get/v2/all" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_ids": ["bd9f2362-84d1-4e01-9762-a5196f9bac80"],
  "name": "john",
  "regions": ["Maharashtra"],
  "mobile_numbers": ["+919876543210"]
}'
```

**Use Case**: Fuzzy name search combined with exact region and mobile filter

---

### 10. Full Filter Combination Example (V2 Only)

```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/institute_learner/get/v2/all?pageNo=0&pageSize=50" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_ids": ["bd9f2362-84d1-4e01-9762-a5196f9bac80"],
  "statuses": ["ACTIVE"],
  "gender": ["FEMALE"],
  "package_session_ids": ["pkg-session-123"],
  "payment_statuses": ["COMPLETED"],
  "regions": ["Maharashtra", "Karnataka"],
  "usernames": ["user1", "user2", "user3"],
  "sub_org_user_types": ["STUDENT"],
  "sort_columns": {
    "created_at": "DESC"
  }
}'
```

**Use Case**: Complex business query - Active female students from specific regions with completed payments, sorted by join date

---

### 11. With Sorting

```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/institute_learner/get/v2/all?pageNo=0&pageSize=10" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_ids": ["bd9f2362-84d1-4e01-9762-a5196f9bac80"],
  "emails": ["test@example.com"],
  "sort_columns": {
    "full_name": "ASC",
    "created_at": "DESC"
  }
}'
```

---

### 12. Empty Filters (Returns All Students in Institute)

```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/institute_learner/get/v2/all?pageNo=0&pageSize=100" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_ids": ["bd9f2362-84d1-4e01-9762-a5196f9bac80"]
}'
```

**Use Case**: Get all students (no filters applied except institute)

---

## Response Structure (V2)

```json
{
  "students": [
    {
      "fullName": "John Doe",
      "email": "john@example.com",
      "username": "john_doe",
      "phone": "+919876543210",
      "packageSessionId": "pkg-123",
      "accessDays": 365,
      "paymentStatus": "COMPLETED",
      "customFieldsJson": "[{\"custom_field_id\":\"cf-1\",\"value\":\"value1\"}]",
      "userId": "user-uuid",
      "id": "student-uuid",
      "addressLine": "123 Main St",
      "region": "Maharashtra",
      "city": "Mumbai",
      "pinCode": "400001",
      "dateOfBirth": "2000-01-01",
      "gender": "MALE",
      "fathersName": "Father Name",
      "mothersName": "Mother Name",
      "parentsMobileNumber": "+919876543211",
      "parentsEmail": "parent@example.com",
      "linkedInstituteName": "Institute Name",
      "createdAt": "2024-01-01T00:00:00",
      "updatedAt": "2024-11-20T00:00:00",
      "faceFileId": "face-file-uuid",
      "expiryDate": "2025-12-31T23:59:59",
      "parentsToMotherMobileNumber": "+919876543212",
      "parentsToMotherEmail": "mother@example.com",
      "instituteEnrollmentNumber": "ENR-2024-001",
      "instituteId": "inst-uuid",
      "groupId": "grp-uuid",
      "status": "ACTIVE",
      "paymentPlanJson": "{...}",
      "paymentOptionJson": "{...}",
      "destinationPackageSessionId": "dest-pkg-uuid",
      "userPlanId": "plan-uuid",
      "enrollInviteId": "invite-uuid",
      "password": "encrypted-password"
    }
  ],
  "totalPages": 10,
  "totalElements": 100,
  "pageSize": 10,
  "currentPage": 0
}
```

---

## Common Use Cases

### Use Case 1: Support Ticket Resolution
**Scenario**: Customer support receives ticket with email
```bash
# Find student by email to check their account status
{
  "institute_ids": ["inst-1"],
  "emails": ["customer@example.com"]
}
```

### Use Case 2: Regional Marketing Campaign
**Scenario**: Marketing team wants to target students in specific states
```bash
{
  "institute_ids": ["inst-1"],
  "regions": ["Maharashtra", "Gujarat", "Rajasthan"],
  "statuses": ["ACTIVE"],
  "payment_statuses": ["COMPLETED"]
}
```

### Use Case 3: Phone Verification
**Scenario**: Identity verification via mobile number
```bash
{
  "institute_ids": ["inst-1"],
  "mobile_numbers": ["+919876543210"]
}
```

### Use Case 4: Role-Based Access Management
**Scenario**: Find students with specific role combinations
```bash
{
  "institute_ids": ["inst-1"],
  "sub_org_user_types": ["STUDENT", "MONITOR"]
}
```

### Use Case 5: Bulk Operations
**Scenario**: Process specific list of usernames (e.g., certificate generation)
```bash
{
  "institute_ids": ["inst-1"],
  "usernames": ["user1", "user2", "user3", "user4", "user5"]
}
```

### Use Case 6: Combined Analytics
**Scenario**: Detailed segment analysis
```bash
{
  "institute_ids": ["inst-1"],
  "regions": ["Maharashtra"],
  "gender": ["FEMALE"],
  "statuses": ["ACTIVE"],
  "payment_statuses": ["COMPLETED"],
  "package_session_ids": ["premium-pkg"]
}
```

---

## Testing Checklist

### V2 Endpoint Tests
- [ ] Test with no new filters (backward compatibility)
- [ ] Test with single email filter
- [ ] Test with multiple emails filter
- [ ] Test with single username filter
- [ ] Test with multiple usernames
- [ ] Test with mobile_numbers filter
- [ ] Test with regions filter
- [ ] Test with sub_org_user_types filter (exact set match)
- [ ] Test combining old + new filters
- [ ] Test with name search + new filters
- [ ] Test with empty/null filter values
- [ ] Test pagination with new filters
- [ ] Test sorting with new filters
- [ ] Test with all filters combined

### V1 Endpoint Tests
- [ ] Verify V1 endpoint unchanged
- [ ] Test V1 with existing filters still works
- [ ] Verify V1 response structure unchanged

---

## Performance Considerations

1. **Indexed Columns**: Ensure database indexes on `email`, `username`, `mobile_number`, `region` for optimal performance
2. **Pagination**: Always use pagination for large datasets
3. **Filter Specificity**: More specific filters = faster queries
4. **Role Filtering**: `sub_org_user_types` uses array comparison - slightly slower than simple IN clauses

---

## Migration Notes

### For Frontend Teams
1. V2 endpoint is backward compatible - no breaking changes
2. New filters are optional - omit them to get same behavior as before
3. V1 endpoint remains available and unchanged
4. Snake_case naming convention for JSON fields (e.g., `institute_ids`, not `instituteIds`)

### For Backend Teams
1. All V1 code unchanged
2. V2 repository methods accept additional parameters (with default null handling)
3. SQL uses SpEL expressions for null-safe filtering
4. No database schema changes required

---

## Error Scenarios

### Invalid Request - Missing Required Field
```json
{
  "emails": ["test@example.com"]
  // Missing institute_ids - will return empty or error
}
```

### Empty Result Set
```json
{
  "institute_ids": ["inst-1"],
  "emails": ["nonexistent@example.com"]
}
// Response: Empty students array with totalElements: 0
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| V2 | 2024-11-20 | Added 5 new filters: usernames, emails, mobile_numbers, regions, sub_org_user_types |
| V1 | Original | Base implementation with standard filters |

---

## Contact & Support

For questions or issues:
- **API Endpoint**: `/admin-core-service/institute/institute_learner/get/v2/all`
- **Controller**: `StudentGetV2Controller`
- **Manager**: `StudentListManager.getLinkedStudentsV2()`
- **Repository**: `InstituteStudentRepository.getAllStudentV2WithFilterRaw()` / `getAllStudentV2WithSearchRaw()`
