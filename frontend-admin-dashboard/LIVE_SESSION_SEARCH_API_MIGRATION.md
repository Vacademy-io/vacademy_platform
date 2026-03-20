# Live Session Search API Migration

## Overview
Successfully migrated the live session list page from client-side filtering and pagination to server-side implementation using the new unified search API.

## Changes Made

### 1. API Integration (`src/constants/urls.ts`)
- Added new constant: `SEARCH_SESSIONS = ${BASE_URL}/admin-core-service/get-sessions/search`

### 2. Types and Services (`src/routes/study-library/live-session/-services/utils.ts`)
Added comprehensive TypeScript interfaces for the new search API:

#### Request Interface (`SessionSearchRequest`)
```typescript
{
  institute_id: string;           // Required
  page?: number;                  // Server-side pagination (0-indexed)
  size?: number;                  // Items per page
  sort_by?: string;              // Field to sort by
  sort_direction?: 'ASC' | 'DESC';
  statuses?: string[];           // ['LIVE', 'DRAFT']
  session_ids?: string[];
  start_date?: string;           // yyyy-MM-dd
  end_date?: string;             // yyyy-MM-dd
  start_time_of_day?: string;    // HH:mm:ss
  end_time_of_day?: string;      // HH:mm:ss
  recurrence_types?: string[];   // ['ONCE', 'WEEKLY', etc.]
  access_levels?: string[];      // ['PUBLIC', 'PRIVATE']
  batch_ids?: string[];
  user_ids?: string[];
  search_query?: string;         // Text search across title and subject
  timezones?: string[];
  schedule_ids?: string[];
  streaming_service_types?: string[];  // ['ZOOM', 'GOOGLE_MEET', etc.]
}
```

#### Response Interface (`SessionSearchResponse`)
```typescript
{
  sessions: SessionSearchResponseItem[];
  pagination: {
    current_page: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}
```

### 3. React Query Hook (`src/routes/study-library/live-session/-hooks/useLiveSessions.ts`)
- Added `useSessionSearch(request: SessionSearchRequest)` hook
- Returns paginated session data with server-side filtering applied

### 4. UI Component (`src/routes/study-library/live-session/-components/sessions-list-page.tsx`)
Complete rewrite with the following improvements:

#### Filter Components Added:
1. **Search Query** - Text search across session title and subject
2. **Date Range** - With quick presets (Today, Past Week, Past Month, Next Week, Next Month)
3. **Time of Day** - Filter sessions by start/end time within the day
4. **Meeting Type** - Once, Weekly, Custom recurrence patterns
5. **Subject** - Dropdown with institute subjects
6. **Access Type** - Public/Private sessions
7. **Streaming Platform** - Zoom, Google Meet, YouTube, Other
8. **Batch** - Multi-select batch filter (package_session_id) using SelectChips component

#### Server-Side Features:
- **Pagination**: Proper server-side pagination with page metadata
- **Tab Management**: Different tabs (Live, Upcoming, Past, Drafts) use appropriate status filters
- **Smart Defaults**:
  - Live tab: Shows sessions happening TODAY (timezone-aware)
  - Upcoming tab: Automatically sets start_date to tomorrow
  - Past tab: Automatically sets end_date to yesterday
  - Draft tab: Shows all draft sessions
- **Real-time Updates**: All filters trigger new API calls with updated parameters

#### Timezone Handling:
The API is timezone-aware and handles all date/time comparisons at the server level:
- Each session's timezone is used for comparisons
- "Today" means "today in the session's timezone"
- Falls back to 'Asia/Kolkata' if session has no timezone set
- No complex client-side timezone conversion needed

### 5. Tailwind Configuration Updates
- Added `primary-600` color to `tailwind.config.mjs`
- Added `--primary-600` CSS variable to `src/index.css`

## Benefits

### Performance
1. **Reduced Data Transfer**: Only fetch sessions for current page
2. **Faster Filtering**: Database-level filtering instead of client-side
3. **Efficient Pagination**: No need to load all sessions upfront
4. **Smart Query Building**: Dynamic SQL only includes needed conditions

### Scalability
1. **Handles Large Datasets**: Can efficiently handle institutes with thousands of sessions
2. **Configurable Page Size**: Currently set to 10 items per page
3. **Indexed Database Queries**: Backend uses proper indexes for fast queries

### User Experience
1. **More Filter Options**: Added streaming platform, time of day, and more
2. **Better Date Filtering**: Quick presets for common date ranges
3. **Timezone Awareness**: Automatic timezone handling by API
4. **Clear Visual Feedback**: Active filters highlighted, loading states
5. **Responsive Design**: Filters adapt to screen size

## API Behavior

### Status Filtering by Tab
- **Live Tab**: `statuses: ['LIVE']` + no date filters (shows today's live sessions)
- **Upcoming Tab**: `statuses: ['LIVE']` + `start_date: tomorrow`
- **Past Tab**: `statuses: ['LIVE']` + `end_date: yesterday`
- **Drafts Tab**: `statuses: ['DRAFT']`

### Search Query
The `search_query` parameter performs case-insensitive search across:
- Session title
- Session subject

Note: Subject filter is currently combined with search_query since the API doesn't have a dedicated subject filter.

### Date Range Examples
```typescript
// Get sessions for next week
{
  start_date: '2025-10-26',
  end_date: '2025-11-02'
}

// Get sessions happening in the morning
{
  start_time_of_day: '06:00:00',
  end_time_of_day: '12:00:00'
}
```

## Migration from Old Endpoints

### Old Implementation (Removed)
```typescript
// Multiple API calls
useLiveSessions(instituteId)
useUpcomingSessions(instituteId)
usePastSessions(instituteId)
useDraftSessions(instituteId)

// Client-side filtering
const filtered = sessions.filter(s => /* complex logic */)

// Client-side pagination
const paginated = filtered.slice(start, end)
```

### New Implementation
```typescript
// Single API call with all parameters
const searchRequest = {
  institute_id: INSTITUTE_ID,
  page: currentPage,
  size: 10,
  statuses: ['LIVE'],
  search_query: 'mathematics',
  start_date: '2025-10-25',
  // ... more filters
};

const { data, isLoading, error } = useSessionSearch(searchRequest);
```

## Testing Recommendations

1. **Tab Switching**: Verify each tab shows appropriate sessions
2. **Pagination**: Test navigating through multiple pages
3. **Filters**: Test each filter individually and in combination
4. **Search**: Test text search with various queries
5. **Date Ranges**: Test quick presets and custom date ranges
6. **Time of Day**: Test filtering by time range
7. **Clear Filters**: Verify "Clear All" button resets all filters
8. **Empty States**: Verify appropriate messages when no sessions found
9. **Loading States**: Check loading indicators during API calls
10. **Error Handling**: Test with network errors

## Future Enhancements

1. ~~**Batch Filter**: Add UI to filter by specific batches (API supports it)~~ ✅ **COMPLETED**
2. **User Filter**: Add UI to filter by specific users (API supports it)
3. **Subject Filter**: Request dedicated subject filter in API instead of using search_query
4. **Saved Filters**: Allow users to save common filter combinations
5. **Export**: Add option to export filtered session list
6. **Bulk Actions**: Enable bulk operations on filtered sessions

## Technical Notes

### React Query Caching
- Set `staleTime: 0` to ensure fresh data on every query
- Query key includes full request object for proper cache invalidation
- Filters trigger new queries automatically via dependencies

### Component State Management
- Single `currentPage` state for pagination (resets on filter change)
- Individual state for each filter type
- Tab state controls session status filtering

### Performance Considerations
- API has 30-second cache with `PRIVATE` scope
- Maximum page size is 100 items (currently using 10)
- All list filters are implemented server-side for optimal performance

## Breaking Changes
None - This is a new implementation that replaces the old one. The old API endpoints still exist and work.

## Dependencies
No new dependencies added. Uses existing:
- @tanstack/react-query
- date-fns
- date-fns-tz (already in use for other timezone features)

## Rollback Plan
If issues arise, can temporarily revert to old implementation by:
1. Restore old `sessions-list-page.tsx` from git history
2. Keep new API types and hooks for future use
3. Old endpoints (`/live`, `/upcoming`, `/past`, `/draft`) still work

