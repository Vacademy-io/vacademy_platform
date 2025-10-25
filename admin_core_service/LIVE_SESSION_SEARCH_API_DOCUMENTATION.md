# Live Session Search API Documentation

## Overview
The Live Session Search API is a comprehensive, unified POST endpoint that replaces the need for multiple GET endpoints. It provides powerful filtering, pagination, and sorting capabilities for querying live sessions.

## Endpoint
```
POST /admin-core-service/get-sessions/search
```

## Authentication
- Requires authentication via `X-User-Id` header
- Access controlled by `@RequestAttribute("user") CustomUserDetails user`

## Request Body

### SessionSearchRequest DTO

```json
{
  "institute_id": "string (required)",
  "page": 0,
  "size": 20,
  "sort_by": "meetingDate",
  "sort_direction": "ASC",
  "statuses": ["LIVE", "DRAFT"],
  "session_ids": ["uuid1", "uuid2"],
  "start_date": "2025-01-01",
  "end_date": "2025-02-01",
  "start_time_of_day": "09:00:00",
  "end_time_of_day": "17:00:00",
  "recurrence_types": ["ONE_TIME", "WEEKLY"],
  "access_levels": ["PUBLIC", "PRIVATE"],
  "batch_ids": ["batch-uuid-1"],
  "user_ids": ["user-uuid-1"],
  "search_query": "mathematics",
  "timezones": ["Asia/Kolkata"],
  "schedule_ids": ["schedule-uuid-1"],
  "streaming_service_types": ["ZOOM", "GOOGLE_MEET"]
}
```

### Field Descriptions

#### Required Fields
- **`institute_id`** (string, required): The institute ID to filter sessions

#### Pagination
- **`page`** (integer, default: 0, min: 0): Page number (0-indexed)
- **`size`** (integer, default: 20, min: 1, max: 100): Number of items per page

#### Sorting
- **`sort_by`** (string, default: "meetingDate"): Field to sort by
  - Options: `meetingDate`, `startTime`, `title`, `createdAt`
- **`sort_direction`** (string, default: "ASC"): Sort direction
  - Options: `ASC`, `DESC`

#### Status & Session Filters
- **`statuses`** (array of strings): Session statuses to include
  - Options: `LIVE`, `DRAFT`
  - Default behavior: If empty/null, shows `LIVE` and `DRAFT` (excludes `DELETED`)
  - `DELETED` sessions are always filtered out at the schedule level
  
- **`session_ids`** (array of strings): Specific session IDs to filter
  - If empty/null: Returns all sessions (subject to other filters)

#### Date & Time Filters
- **`start_date`** (date): Include sessions on or after this date (format: YYYY-MM-DD)
- **`end_date`** (date): Include sessions on or before this date (format: YYYY-MM-DD)
- **Smart Defaults** (when both start_date and end_date are null):
  - For upcoming sessions (LIVE/DRAFT): Shows next 1 month from today
  - Default: Next month sessions
  
- **`start_time_of_day`** (time): Filter sessions starting at or after this time (format: HH:MM:SS)
- **`end_time_of_day`** (time): Filter sessions starting at or before this time (format: HH:MM:SS)

#### Session Configuration Filters
- **`recurrence_types`** (array of strings): Filter by recurrence pattern
  - Examples: `ONE_TIME`, `DAILY`, `WEEKLY`, `MONTHLY`
  
- **`access_levels`** (array of strings): Filter by access level
  - Examples: `PUBLIC`, `PRIVATE`
  
- **`streaming_service_types`** (array of strings): Filter by streaming platform
  - Examples: `ZOOM`, `GOOGLE_MEET`, `MS_TEAMS`
  
- **`timezones`** (array of strings): Filter by timezone
  - Examples: `Asia/Kolkata`, `America/New_York`

#### Participant Filters
- **`batch_ids`** (array of strings): Filter sessions assigned to specific batches
- **`user_ids`** (array of strings): Filter sessions assigned to specific users
- Note: These filters use the `live_session_participants` table with `source_type` and `source_id`

#### Text Search
- **`search_query`** (string): Search across session title and subject (case-insensitive)
  - Uses SQL `LIKE` with wildcards for partial matching
  
#### Schedule Filters
- **`schedule_ids`** (array of strings): Filter specific schedule IDs

## Response Format

### SessionSearchResponse

```json
{
  "sessions": [
    {
      "session_id": "uuid",
      "waiting_room_time": 10,
      "thumbnail_file_id": "file-uuid",
      "background_score_file_id": "audio-uuid",
      "session_streaming_service_type": "ZOOM",
      "schedule_id": "schedule-uuid",
      "meeting_date": "2025-01-15",
      "start_time": "10:00:00",
      "last_entry_time": "10:15:00",
      "recurrence_type": "WEEKLY",
      "access_level": "PRIVATE",
      "title": "Mathematics Class",
      "subject": "Algebra",
      "meeting_link": "https://zoom.us/j/123456789",
      "registration_form_link_for_public_sessions": null,
      "timezone": "Asia/Kolkata"
    }
  ],
  "pagination": {
    "current_page": 0,
    "page_size": 20,
    "total_elements": 45,
    "total_pages": 3,
    "has_next": true,
    "has_previous": false
  }
}
```

### Response Fields

#### Session Object
- **`session_id`**: Unique session identifier
- **`waiting_room_time`**: Minutes before session users can enter waiting room
- **`thumbnail_file_id`**: Session thumbnail image ID
- **`background_score_file_id`**: Background music/audio file ID
- **`session_streaming_service_type`**: Streaming platform type
- **`schedule_id`**: Specific schedule instance ID
- **`meeting_date`**: Date of the session
- **`start_time`**: Session start time
- **`last_entry_time`**: Latest time users can join
- **`recurrence_type`**: Session recurrence pattern
- **`access_level`**: Public or private access
- **`title`**: Session title
- **`subject`**: Session subject/topic
- **`meeting_link`**: Actual meeting link (custom or default)
- **`registration_form_link_for_public_sessions`**: Registration form URL for public sessions
- **`timezone`**: Session timezone

#### Pagination Metadata
- **`current_page`**: Current page number (0-indexed)
- **`page_size`**: Number of items per page
- **`total_elements`**: Total number of matching sessions
- **`total_pages`**: Total number of pages
- **`has_next`**: Whether there's a next page
- **`has_previous`**: Whether there's a previous page

## Example Use Cases

### 1. Get All Live Sessions for Today
```json
{
  "institute_id": "inst-123",
  "statuses": ["LIVE"],
  "start_date": "2025-10-25",
  "end_date": "2025-10-25"
}
```

### 2. Get Upcoming Sessions for Next Week
```json
{
  "institute_id": "inst-123",
  "statuses": ["LIVE", "DRAFT"],
  "start_date": "2025-10-26",
  "end_date": "2025-11-02"
}
```

### 3. Search Sessions by Title/Subject
```json
{
  "institute_id": "inst-123",
  "search_query": "mathematics"
}
```

### 4. Get Sessions for a Specific Batch
```json
{
  "institute_id": "inst-123",
  "batch_ids": ["batch-uuid-1"],
  "start_date": "2025-10-25",
  "end_date": "2025-11-25"
}
```

### 5. Get Morning Sessions Only
```json
{
  "institute_id": "inst-123",
  "start_time_of_day": "06:00:00",
  "end_time_of_day": "12:00:00"
}
```

### 6. Get Public Weekly Sessions
```json
{
  "institute_id": "inst-123",
  "access_levels": ["PUBLIC"],
  "recurrence_types": ["WEEKLY"]
}
```

### 7. Paginated Results with Custom Sort
```json
{
  "institute_id": "inst-123",
  "page": 1,
  "size": 50,
  "sort_by": "startTime",
  "sort_direction": "DESC"
}
```

## Default Behaviors

### When No Filters Are Provided
- **Statuses**: Shows `LIVE` and `DRAFT` only (excludes `DELETED`)
- **Date Range**: Shows next 1 month from today
- **Pagination**: Page 0, Size 20
- **Sorting**: By meeting date ascending, then start time ascending

### Deleted Sessions
- Sessions with `status = 'DELETED'` are never returned
- Schedules with `status = 'DELETED'` are filtered out

### Empty Lists vs Null
- Empty list `[]` = No filter on that dimension (show all)
- Null = Use default behavior

## Performance Considerations

1. **Indexes**: Ensure these database indexes exist:
   - `institute_id, status, meeting_date`
   - `session_id, status`
   - `meeting_date, start_time`

2. **Pagination Limits**: Maximum page size is 100 items

3. **Query Optimization**: 
   - Uses `DISTINCT` to handle participant joins
   - Dynamic query building only includes conditions for non-null filters
   - Count query is optimized separately from data query

4. **Caching**: Client-side caching enabled for 30 seconds with `PRIVATE` scope

## Migration Notes

### Old Endpoints (Still Available)
- `GET /admin-core-service/get-sessions/live`
- `GET /admin-core-service/get-sessions/upcoming`
- `GET /admin-core-service/get-sessions/past`
- `GET /admin-core-service/get-sessions/draft`
- `GET /admin-core-service/get-sessions/learner/live-and-upcoming`
- `GET /admin-core-service/get-sessions/by-user-id`

### Advantages of New Search API
1. **Single endpoint** instead of 6+ different endpoints
2. **Flexible filtering** with multiple dimensions
3. **Proper pagination** with metadata
4. **Configurable sorting**
5. **Better performance** with dynamic query building
6. **Combines filters** (e.g., batch + user + date range)

## Technical Implementation

### Architecture
- **Controller**: `GetSessionsListController.searchSessions()`
- **Service**: `GetLiveSessionService.searchSessions()`
- **Repository**: 
  - Interface: `LiveSessionRepositoryCustom`
  - Implementation: `LiveSessionRepositoryCustomImpl` (uses JPA EntityManager with native queries)
- **DTOs**: 
  - Request: `SessionSearchRequest`
  - Response: `SessionSearchResponse`

### Query Building
- Uses dynamic SQL query construction
- Parameterized queries prevent SQL injection
- Smart joins only when needed (e.g., participants join only if filtering by batch/user)
- Separate count and data queries for efficient pagination

### Result Mapping
- Uses `@SqlResultSetMapping` with `@ConstructorResult`
- Implementation class: `LiveSessionListProjectionImpl`
- Returns Spring Data `Page<>` object with full pagination metadata

