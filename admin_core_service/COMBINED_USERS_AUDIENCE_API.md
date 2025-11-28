# Combined Users & Audience API Documentation

## Overview
This API returns all users for a given institute from two sources:
1. **Institute Users**: Users enrolled in the institute (from `student_session_institute_group_mapping`)
2. **Audience Respondents**: Users who responded to any campaign/audience for that institute (from `audience_response`)

The API automatically deduplicates users (each user appears only once) and returns all their custom fields.

---

## Endpoint

**POST** `/admin-core-service/v1/audience/distinct-institute-users-and-audience`

---

## Request Structure

### Headers
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

### Request Body

```json
{
  "institute_id": "uuid-of-institute",          // Required
  
  // Source selection (control which user sources to include)
  "include_institute_users": true,              // Default: true (include enrolled students)
  "include_audience_respondents": true,         // Default: true (include campaign respondents)
  
  // Campaign filters (nested object)
  "campaign_filter": {
    "audience_ids": ["aud-uuid-1", "aud-uuid-2"],  // Filter by specific audience/campaign IDs
    "campaign_name": "Summer Campaign",            // Filter by campaign name (partial match)
    "campaign_status": "ACTIVE",                   // Filter by status: ACTIVE, PAUSED, COMPLETED, ARCHIVED
    "campaign_type": "WEBSITE",                    // Filter by type: WEBSITE, GOOGLE_ADS, etc.
    "start_date_from_local": "2024-01-01T00:00:00", // Filter campaigns starting from this date
    "start_date_to_local": "2024-12-31T23:59:59"   // Filter campaigns starting until this date
  },
  
  // User filters (nested object)
  "user_filter": {
    "name_search": "john",                        // Search in name, username, email
    "emails": ["user1@example.com", "user2@example.com"],
    "mobile_numbers": ["+919876543210", "+919876543211"],
    "regions": ["Maharashtra", "Karnataka"],
    "genders": ["MALE", "FEMALE"]
  },
  
  // Pagination (optional)
  "page": 0,                                     // Default: 0
  "size": 20,                                    // Default: 20
  "sort_by": "created_at",                       // Options: created_at, full_name, email, mobile_number
  "sort_direction": "DESC"                       // Options: ASC, DESC
}
```

---

## Response Structure

```json
{
  "users": [
    {
      "user_id": "user-uuid-123",
      "email": "john@example.com",
      "username": "john_doe",
      "full_name": "John Doe",
      "mobile_number": "+919876543210",
      "gender": "MALE",
      "region": "Maharashtra",
      "city": "Mumbai",
      "date_of_birth": "2000-01-01",
      "created_at": "2024-01-15T10:30:00",
      
      // Source tracking flags
      "is_institute_user": true,           // Is this user enrolled in institute?
      "is_audience_respondent": false,     // Did this user respond to any campaign?
      
      // All custom fields for this user
      "custom_fields": [
        {
          "custom_field_id": "cf-uuid-1",
          "field_key": "phone",
          "field_name": "Phone Number",
          "field_type": "TEXT",
          "value": "+919876543210"
        },
        {
          "custom_field_id": "cf-uuid-2",
          "field_key": "city",
          "field_name": "City",
          "field_type": "TEXT",
          "value": "Mumbai"
        }
      ]
    },
    {
      "user_id": "user-uuid-456",
      "email": "jane@example.com",
      "username": "jane_smith",
      "full_name": "Jane Smith",
      "mobile_number": "+919876543211",
      "gender": "FEMALE",
      "region": "Karnataka",
      "city": "Bangalore",
      "date_of_birth": "1999-05-20",
      "created_at": "2024-03-20T09:15:00",
      
      "is_institute_user": false,          // NOT enrolled in institute
      "is_audience_respondent": true,      // Only responded to campaigns
      
      "custom_fields": [
        {
          "custom_field_id": "cf-uuid-3",
          "field_key": "email",
          "field_name": "Email Address",
          "field_type": "EMAIL",
          "value": "jane@example.com"
        }
      ]
    }
  ],
  
  // Pagination metadata
  "total_elements": 150,
  "total_pages": 8,
  "current_page": 0,
  "page_size": 20,
  "is_last": false,
  
  // Optional: Shows which audience IDs were used for filtering (if any)
  "filtered_audience_ids": ["aud-uuid-1", "aud-uuid-2"]
}
```

---

## Data Flow

### Step 1: Determine Source Selection
```
- If include_institute_users = true (default): Fetch institute users
- If include_audience_respondents = true (default): Fetch audience respondents
- If both false: Return empty result
```

### Step 2: Fetch Institute User IDs (if included)
```sql
SELECT DISTINCT user_id 
FROM student_session_institute_group_mapping 
WHERE institute_id = 'xxx'
```

### Step 3: Fetch Audience IDs with Filters (if included)
```sql
-- If campaign_filter.audience_ids is provided:
--   Use the provided audience_ids directly

-- Otherwise, apply campaign filters:
SELECT id FROM audience
WHERE institute_id = 'xxx'
  AND (campaign_name LIKE '%filter%' OR campaign_name IS NULL)
  AND (status = 'ACTIVE' OR status IS NULL)
  AND (campaign_type = 'WEBSITE' OR campaign_type IS NULL)
  AND (start_date >= 'start_date_from' OR start_date IS NULL)
  AND (start_date <= 'start_date_to' OR start_date IS NULL)
```

### Step 4: Fetch Audience Respondent User IDs (if included)
```sql
SELECT DISTINCT user_id 
FROM audience_response 
WHERE audience_id IN (audience_ids) 
  AND user_id IS NOT NULL
```

### Step 5: Merge & Deduplicate
- Combine both user ID lists
- Remove duplicates using Set
- Track source (institute vs audience)

### Step 6: Fetch User Details
- Batch fetch from auth service
- Get basic info: name, email, mobile, etc.

### Step 7: Fetch Custom Fields
```sql
-- For Institute Users:
SELECT cfv.*, cf.* 
FROM custom_field_values cfv
JOIN custom_fields cf ON cfv.custom_field_id = cf.id
WHERE cfv.source_type = 'USER' 
  AND cfv.source_id IN (user_ids)

-- For Audience Respondents:
-- Step 6a: Get response IDs for these users
SELECT id FROM audience_response WHERE user_id IN (user_ids)

-- Step 6b: Get custom fields for these responses
SELECT cfv.*, cf.* 
FROM custom_field_values cfv
JOIN custom_fields cf ON cfv.custom_field_id = cf.id
WHERE cfv.source_type = 'AUDIENCE_RESPONSE' 
  AND cfv.source_id IN (response_ids)

-- Note: For institute users, source_id = user_id
--       For audience responses, source_id = response_id (then map to user_id)
```

### Step 8: Apply Filters & Pagination
- Filter by name, email, mobile, region, gender
- Sort by specified field
- Apply pagination

---

## Example Requests

### 1. Get All Users for Institute (No Filters)

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "page": 0,
  "size": 20
}'
```

---

### 2. Search by Name

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "name_search": "john",
  "page": 0,
  "size": 20
}'
```

---

### 3. Filter by Specific Emails

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "emails": [
    "user1@example.com",
    "user2@example.com",
    "user3@example.com"
  ]
}'
```

---

### 4. Filter by Region and Gender

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "regions": ["Maharashtra", "Karnataka"],
  "genders": ["FEMALE"],
  "page": 0,
  "size": 50
}'
```

---

### 5. Sort by Name (Ascending)

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "sort_by": "full_name",
  "sort_direction": "ASC",
  "page": 0,
  "size": 20
}'
```

---

### 6. Combined Filters

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "name_search": "john",
  "regions": ["Maharashtra"],
  "genders": ["MALE"],
  "sort_by": "created_at",
  "sort_direction": "DESC",
  "page": 0,
  "size": 20
}'
```

---

### 7. Filter by Specific Audiences/Campaigns

**Description**: Get users who responded to specific campaigns

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "campaign_filter": {
    "audience_ids": [
      "campaign-uuid-1",
      "campaign-uuid-2",
      "campaign-uuid-3"
    ]
  }
}'
```

**Use Case**: 
- Get all respondents from specific marketing campaigns
- Analyze users from selected audience segments
- Filter by campaign performance

---

### 8. Only Institute Users (Exclude Audience Respondents)

**Description**: Get only enrolled students, exclude campaign respondents

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "include_institute_users": true,
  "include_audience_respondents": false
}'
```

**Use Case**:
- Get pure enrolled student list
- Exclude leads/prospects from campaigns
- Student-only analytics

---

### 9. Only Audience Respondents (Exclude Institute Users)

**Description**: Get only campaign respondents, exclude enrolled students

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "include_institute_users": false,
  "include_audience_respondents": true
}'
```

**Use Case**:
- Pure leads/prospects list
- Campaign respondents who haven't enrolled yet
- Lead conversion analysis

---

### 10. Filter by Campaign Name

**Description**: Get users from campaigns matching a specific name

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "campaign_filter": {
    "campaign_name": "Summer"
  }
}'
```

**Use Case**:
- Get all users from "Summer Campaign 2024", "Summer Webinar", etc.
- Partial name matching for campaign grouping

---

### 11. Filter by Campaign Status

**Description**: Get users from active campaigns only

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "campaign_filter": {
    "campaign_status": "ACTIVE"
  }
}'
```

**Valid Status Values**: `ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED`

**Use Case**:
- Analyze active campaign performance
- Focus on ongoing marketing efforts

---

### 12. Filter by Campaign Type

**Description**: Get users from specific campaign types

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "campaign_filter": {
    "campaign_type": "WEBSITE"
  }
}'
```

**Common Campaign Types**: `WEBSITE`, `GOOGLE_ADS`, `FACEBOOK`, `EMAIL`, `SMS`

---

### 13. Filter by Campaign Date Range

**Description**: Get users from campaigns within a date range

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "campaign_filter": {
    "start_date_from_local": "2024-01-01T00:00:00",
    "start_date_to_local": "2024-03-31T23:59:59"
  }
}'
```

**Use Case**:
- Q1 campaign analysis
- Seasonal campaign comparison

---

### 14. Combined Campaign Filters

**Description**: Combine multiple campaign filters

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "campaign_filter": {
    "campaign_name": "Webinar",
    "campaign_status": "COMPLETED",
    "campaign_type": "WEBSITE",
    "start_date_from_local": "2024-01-01T00:00:00"
  }
}'
```

**Use Case**:
- Get users from completed website webinars in 2024

---

### 15. Audience Filter + User Demographics

### 15. Audience Filter + User Demographics

**Description**: Combine campaign and user demographic filters

```bash
curl -X POST "http://localhost:8080/admin-core-service/v1/audience/distinct-institute-users-and-audience" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_JWT_TOKEN" \
-d '{
  "institute_id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
  "campaign_filter": {
    "campaign_status": "ACTIVE"
  },
  "user_filter": {
    "regions": ["Maharashtra", "Karnataka"],
    "genders": ["FEMALE"]
  },
  "sort_by": "full_name",
  "sort_direction": "ASC"
}'
```

**Use Case**: 
- Get female respondents from active campaigns in specific regions
- Targeted follow-up campaigns
- Segmented analysis

---

## Use Cases

### Use Case 1: Complete User Database
**Scenario**: Get all users associated with the institute (students + leads)
```json
{
  "institute_id": "inst-uuid"
}
```

### Use Case 2: Marketing Campaign
**Scenario**: Find all users from specific regions for targeted marketing
```json
{
  "institute_id": "inst-uuid",
  "regions": ["Maharashtra", "Gujarat", "Rajasthan"]
}
```

### Use Case 3: Support Lookup
**Scenario**: Find a specific user by email for support
```json
{
  "institute_id": "inst-uuid",
  "emails": ["customer@example.com"]
}
```

### Use Case 4: Analytics
**Scenario**: Get users sorted by join date for cohort analysis
```json
{
  "institute_id": "inst-uuid",
  "sort_by": "created_at",
  "sort_direction": "DESC",
  "size": 100
}
```

---

## Response Fields Explanation

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | String | Unique user identifier |
| `email` | String | User's email address |
| `username` | String | User's username |
| `full_name` | String | User's full name |
| `mobile_number` | String | User's mobile number |
| `gender` | String | User's gender (MALE, FEMALE, OTHER) |
| `region` | String | User's region/state |
| `city` | String | User's city |
| `date_of_birth` | Date | User's date of birth |
| `created_at` | Date | When user was created |
| `is_institute_user` | Boolean | True if user is enrolled in institute |
| `is_audience_respondent` | Boolean | True if user responded to any campaign |
| `custom_fields` | Array | All custom fields for this user |
| `filtered_audience_ids` | Array | List of audience IDs used for filtering (if any) |

---

## Custom Fields Structure

Each custom field object contains:

| Field | Type | Description |
|-------|------|-------------|
| `custom_field_id` | String | Unique identifier for the custom field definition |
| `field_key` | String | Programmatic key for the field (e.g., "phone", "city") |
| `field_name` | String | Display name for the field (e.g., "Phone Number") |
| `field_type` | String | Data type (TEXT, EMAIL, NUMBER, DATE, etc.) |
| `value` | String | The actual value for this user |

---

## Deduplication Logic

- Users are uniquely identified by `user_id`
- If a user exists in BOTH sources (institute + audience), they appear ONCE
- Both flags (`is_institute_user` and `is_audience_respondent`) will be `true`
- Custom fields from both sources are merged

**Example:**
```
User A: Enrolled in institute AND responded to campaign
  → Returns once with both flags = true
  → Custom fields from both sources included

User B: Only enrolled in institute
  → is_institute_user = true
  → is_audience_respondent = false

User C: Only responded to campaign
  → is_institute_user = false
  → is_audience_respondent = true
```

---

## Performance Considerations

1. **Batch Queries**: Service uses batch queries to minimize database calls
2. **Pagination**: Always use pagination for large datasets
3. **Indexing**: Ensure indexes on:
   - `student_session_institute_group_mapping.institute_id`
   - `student_session_institute_group_mapping.user_id`
   - `audience.institute_id`
   - `audience_response.audience_id`
   - `audience_response.user_id`
   - `custom_field_values.source_id`
   - `custom_field_values.source_type`

---

## Error Scenarios

### Missing Institute ID
```json
{
  "error": "Institute ID is required"
}
```

### Invalid Institute ID
```json
{
  "error": "Institute not found"
}
```

### No Users Found
```json
{
  "users": [],
  "total_elements": 0,
  "total_pages": 0,
  "current_page": 0,
  "page_size": 20,
  "is_last": true
}
```

---

## Filter Behavior

### Source Selection
- **`include_institute_users`** (default: `true`):
  - `true`: Include enrolled students from institute
  - `false`: Exclude institute students
  
- **`include_audience_respondents`** (default: `true`):
  - `true`: Include campaign respondents
  - `false`: Exclude campaign respondents

- **Both `true`** (default): Returns institute users + audience respondents
- **Both `false`**: Returns empty result

### Campaign Filters (apply when include_audience_respondents = true)
- All campaign filters use **AND** logic
- Empty/null campaign filters are ignored
- `campaign_name` uses partial case-insensitive matching
- Other campaign filters use exact matching

### User Filters
- All filters use **AND** logic (must match all specified filters)
- Within a filter array, values use **OR** logic
- Empty/null filters are ignored
- Name search is case-insensitive and uses partial matching
- Other filters use exact matching

**Example 1 - Only Institute Users:**
```json
{
  "institute_id": "inst-123",
  "include_institute_users": true,
  "include_audience_respondents": false
}
```
Returns: Enrolled students only

**Example 2 - Only Audience Respondents from Active Campaigns:**
```json
{
  "institute_id": "inst-123",
  "include_institute_users": false,
  "include_audience_respondents": true,
  "campaign_filter": {
    "campaign_status": "ACTIVE"
  }
}
```
Returns: Campaign respondents from active campaigns only

**Example 3 - Both Sources with Filters:**
```json
{
  "institute_id": "inst-123",
  "campaign_filter": {
    "campaign_name": "Webinar"
  },
  "user_filter": {
    "regions": ["Maharashtra"],
    "genders": ["FEMALE"]
  }
}
```
Returns: 
- Institute users (all) + respondents from "Webinar" campaigns
- Filtered by: Female users from Maharashtra

---

## API Version
- **Version**: 1.0
- **Date**: November 26, 2025
- **Endpoint**: `/admin-core-service/v1/audience/distinct-institute-users-and-audience`
- **Method**: POST
- **Authentication**: Required (JWT Bearer Token)

---

## Technical Implementation

### Files Created/Modified:

1. **DTOs**:
   - `CombinedUserAudienceRequestDTO.java`
   - `CombinedUserAudienceResponseDTO.java`
   - `UserWithCustomFieldsDTO.java`
   - `CustomFieldDTO.java`

2. **Service**:
   - `CombinedUserAudienceService.java`

3. **Controller**:
   - `AudienceController.java` (updated)

4. **Repositories** (updated):
   - `AudienceRepository.java` - Added `findAllAudienceIdsByInstituteId()`
   - `AudienceResponseRepository.java` - Added `findDistinctUserIdsByAudienceIds()`
   - `InstituteStudentRepository.java` - Added `findDistinctUserIdsByInstituteId()`

---

## Contact & Support

For questions or issues related to this API:
- **Controller**: `AudienceController.getCombinedUsersWithCustomFields()`
- **Service**: `CombinedUserAudienceService.getCombinedUsersWithCustomFields()`
