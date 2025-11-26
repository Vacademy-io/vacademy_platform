# Live Session Search API - Frontend Integration Guide

## 📌 Quick Reference

**Endpoint:** `POST /admin-core-service/get-sessions/search`  
**Method:** POST  
**Authentication:** Bearer Token (JWT)  
**Content-Type:** `application/json`

---

## 🚀 Quick Start

### Basic Request
```javascript
const searchSessions = async (filters) => {
  const response = await fetch('http://localhost:8072/admin-core-service/get-sessions/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      institute_id: "your-institute-id",
      page: 0,
      size: 20,
      ...filters
    })
  });
  
  return await response.json();
};
```

### Response Structure
```javascript
{
  sessions: [...],      // Array of session objects
  pagination: {
    current_page: 0,
    page_size: 20,
    total_elements: 124,
    total_pages: 7,
    has_next: true,
    has_previous: false
  }
}
```

---

## 📝 TypeScript Interfaces

### Request Interface
```typescript
interface SessionSearchRequest {
  // Required
  institute_id: string;
  
  // Pagination
  page?: number;              // Default: 0
  size?: number;              // Default: 20, Max: 100
  
  // Sorting
  sort_by?: 'meetingDate' | 'startTime' | 'title' | 'createdAt';  // Default: 'meetingDate'
  sort_direction?: 'ASC' | 'DESC';  // Default: 'ASC'
  
  // Filters
  statuses?: ('LIVE' | 'DRAFT')[];
  session_ids?: string[];
  start_date?: string;        // Format: "YYYY-MM-DD"
  end_date?: string;          // Format: "YYYY-MM-DD"
  start_time_of_day?: string; // Format: "HH:MM:SS"
  end_time_of_day?: string;   // Format: "HH:MM:SS"
  recurrence_types?: string[];
  access_levels?: ('PUBLIC' | 'PRIVATE')[];
  batch_ids?: string[];
  user_ids?: string[];
  search_query?: string;
  timezones?: string[];
  schedule_ids?: string[];
  streaming_service_types?: string[];
}
```

### Response Interface
```typescript
interface Session {
  session_id: string;
  waiting_room_time: number;
  thumbnail_file_id: string | null;
  background_score_file_id: string | null;
  session_streaming_service_type: string;
  schedule_id: string;
  meeting_date: string;       // "YYYY-MM-DD"
  start_time: string;         // "HH:MM:SS"
  last_entry_time: string;    // "HH:MM:SS"
  recurrence_type: string;
  access_level: 'public' | 'private';
  title: string;
  subject: string;
  meeting_link: string;
  registration_form_link_for_public_sessions: string | null;
  timezone: string;
}

interface Pagination {
  current_page: number;
  page_size: number;
  total_elements: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface SessionSearchResponse {
  sessions: Session[];
  pagination: Pagination;
}
```

---

## 💡 Common Use Cases

### 1. Get All Upcoming Sessions (Default)
```javascript
const getUpcomingSessions = async () => {
  const response = await searchSessions({
    institute_id: instituteId,
    // No dates = next month by default
  });
  return response;
};
```

### 2. Get Live Sessions for Today
```javascript
const getTodayLiveSessions = async () => {
  const today = new Date().toISOString().split('T')[0]; // "2025-10-25"
  
  return await searchSessions({
    institute_id: instituteId,
    statuses: ['LIVE'],
    start_date: today,
    end_date: today
  });
};
```

### 3. Search Sessions by Title/Subject
```javascript
const searchByText = async (searchText) => {
  return await searchSessions({
    institute_id: instituteId,
    search_query: searchText  // Case-insensitive
  });
};
```

### 4. Paginated List with Custom Sort
```javascript
const getSessionsPage = async (page, pageSize = 20) => {
  return await searchSessions({
    institute_id: instituteId,
    page: page,
    size: pageSize,
    sort_by: 'startTime',
    sort_direction: 'DESC'
  });
};
```

### 5. Filter by Date Range
```javascript
const getSessionsInRange = async (startDate, endDate) => {
  return await searchSessions({
    institute_id: instituteId,
    start_date: startDate,    // "2025-10-25"
    end_date: endDate         // "2025-11-25"
  });
};
```

### 6. Filter by Batch
```javascript
const getBatchSessions = async (batchId) => {
  return await searchSessions({
    institute_id: instituteId,
    batch_ids: [batchId]
  });
};
```

### 7. Get Morning Sessions Only
```javascript
const getMorningSessions = async () => {
  return await searchSessions({
    institute_id: instituteId,
    start_time_of_day: "06:00:00",
    end_time_of_day: "12:00:00"
  });
};
```

### 8. Get Public Sessions Only
```javascript
const getPublicSessions = async () => {
  return await searchSessions({
    institute_id: instituteId,
    access_levels: ['PUBLIC']
  });
};
```

### 9. Combine Multiple Filters
```javascript
const getFilteredSessions = async (filters) => {
  return await searchSessions({
    institute_id: instituteId,
    statuses: filters.statuses || ['LIVE', 'DRAFT'],
    start_date: filters.startDate,
    end_date: filters.endDate,
    search_query: filters.searchText,
    batch_ids: filters.batchIds,
    access_levels: filters.accessLevels,
    recurrence_types: filters.recurrenceTypes,
    page: filters.page || 0,
    size: filters.pageSize || 20
  });
};
```

---

## ⚛️ React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface UseSessionSearchParams {
  instituteId: string;
  filters?: Partial<SessionSearchRequest>;
  autoFetch?: boolean;
}

const useSessionSearch = ({ instituteId, filters = {}, autoFetch = true }: UseSessionSearchParams) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchSessions = async (customFilters = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/admin-core-service/get-sessions/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          institute_id: instituteId,
          ...filters,
          ...customFilters
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SessionSearchResponse = await response.json();
      setSessions(data.sessions);
      setPagination(data.pagination);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sessions';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch && instituteId) {
      searchSessions();
    }
  }, [instituteId, autoFetch]);

  return {
    sessions,
    pagination,
    loading,
    error,
    searchSessions,
    refetch: searchSessions
  };
};

// Usage in Component
const SessionsList = () => {
  const { sessions, pagination, loading, error, searchSessions } = useSessionSearch({
    instituteId: 'your-institute-id',
    filters: {
      statuses: ['LIVE'],
      page: 0,
      size: 20
    }
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {sessions.map(session => (
        <SessionCard key={session.schedule_id} session={session} />
      ))}
      
      {pagination && (
        <Pagination
          currentPage={pagination.current_page}
          totalPages={pagination.total_pages}
          onPageChange={(page) => searchSessions({ page })}
        />
      )}
    </div>
  );
};
```

---

## 🎨 Filter Component Example

```typescript
import { useState } from 'react';

const SessionFilters = ({ onFilterChange, instituteId }) => {
  const [filters, setFilters] = useState({
    search_query: '',
    statuses: [],
    start_date: '',
    end_date: '',
    access_levels: [],
    recurrence_types: []
  });

  const handleSearch = () => {
    onFilterChange({
      institute_id: instituteId,
      ...filters,
      page: 0  // Reset to first page
    });
  };

  const handleReset = () => {
    const resetFilters = {
      search_query: '',
      statuses: [],
      start_date: '',
      end_date: '',
      access_levels: [],
      recurrence_types: []
    };
    setFilters(resetFilters);
    onFilterChange({
      institute_id: instituteId,
      page: 0
    });
  };

  return (
    <div className="filters">
      {/* Search Input */}
      <input
        type="text"
        placeholder="Search sessions..."
        value={filters.search_query}
        onChange={(e) => setFilters({ ...filters, search_query: e.target.value })}
      />

      {/* Status Filter */}
      <select
        multiple
        value={filters.statuses}
        onChange={(e) => setFilters({
          ...filters,
          statuses: Array.from(e.target.selectedOptions, option => option.value)
        })}
      >
        <option value="LIVE">Live</option>
        <option value="DRAFT">Draft</option>
      </select>

      {/* Date Range */}
      <input
        type="date"
        value={filters.start_date}
        onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
      />
      <input
        type="date"
        value={filters.end_date}
        onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
      />

      {/* Access Level */}
      <select
        multiple
        value={filters.access_levels}
        onChange={(e) => setFilters({
          ...filters,
          access_levels: Array.from(e.target.selectedOptions, option => option.value)
        })}
      >
        <option value="PUBLIC">Public</option>
        <option value="PRIVATE">Private</option>
      </select>

      {/* Buttons */}
      <button onClick={handleSearch}>Search</button>
      <button onClick={handleReset}>Reset</button>
    </div>
  );
};
```

---

## 📄 Pagination Component Example

```typescript
const Pagination = ({ currentPage, totalPages, hasNext, hasPrevious, onPageChange }) => {
  return (
    <div className="pagination">
      <button
        disabled={!hasPrevious}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Previous
      </button>

      <span>
        Page {currentPage + 1} of {totalPages}
      </span>

      <button
        disabled={!hasNext}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
      </button>
    </div>
  );
};
```

---

## 🔧 Utility Functions

### Date Formatting
```typescript
// Format date for API (YYYY-MM-DD)
const formatDateForAPI = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Get today's date
const getTodayDate = (): string => {
  return formatDateForAPI(new Date());
};

// Get date range (e.g., next 7 days)
const getDateRange = (daysAhead: number) => {
  const today = new Date();
  const future = new Date();
  future.setDate(today.getDate() + daysAhead);
  
  return {
    start_date: formatDateForAPI(today),
    end_date: formatDateForAPI(future)
  };
};
```

### Filter Helpers
```typescript
// Remove empty filters
const cleanFilters = (filters: Partial<SessionSearchRequest>) => {
  return Object.fromEntries(
    Object.entries(filters).filter(([_, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim() !== '';
      return value != null;
    })
  );
};

// Build query from form state
const buildSearchQuery = (formState: any) => {
  return cleanFilters({
    institute_id: formState.instituteId,
    search_query: formState.searchText,
    statuses: formState.selectedStatuses,
    start_date: formState.startDate,
    end_date: formState.endDate,
    access_levels: formState.selectedAccessLevels,
    batch_ids: formState.selectedBatches,
    page: formState.currentPage || 0,
    size: formState.pageSize || 20,
    sort_by: formState.sortBy || 'meetingDate',
    sort_direction: formState.sortDirection || 'ASC'
  });
};
```

---

## ⚠️ Error Handling

```typescript
const searchSessionsWithErrorHandling = async (filters) => {
  try {
    const response = await fetch('/admin-core-service/get-sessions/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(filters)
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized. Please login again.');
      } else if (response.status === 400) {
        const error = await response.json();
        throw new Error(`Invalid request: ${error.message || 'Bad Request'}`);
      } else if (response.status === 500) {
        throw new Error('Server error. Please try again later.');
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Search sessions error:', error);
    throw error;
  }
};
```

---

## 🎯 Best Practices

### 1. **Always Include institute_id**
```typescript
// ✅ Good
const filters = {
  institute_id: currentInstituteId,  // Always required
  statuses: ['LIVE']
};

// ❌ Bad
const filters = {
  statuses: ['LIVE']  // Missing institute_id
};
```

### 2. **Handle Empty Arrays Properly**
```typescript
// Empty arrays = no filter (show all)
const filters = {
  institute_id: instituteId,
  statuses: [],        // Shows LIVE and DRAFT (default)
  batch_ids: []        // Shows all batches
};
```

### 3. **Reset Page on Filter Change**
```typescript
const handleFilterChange = (newFilters) => {
  searchSessions({
    ...newFilters,
    page: 0  // Always reset to first page when filters change
  });
};
```

### 4. **Debounce Search Input**
```typescript
import { debounce } from 'lodash';

const debouncedSearch = debounce((searchQuery) => {
  searchSessions({
    institute_id: instituteId,
    search_query: searchQuery,
    page: 0
  });
}, 500);

// In component
<input
  type="text"
  onChange={(e) => debouncedSearch(e.target.value)}
  placeholder="Search..."
/>
```

### 5. **Cache Results**
```typescript
// Use React Query or SWR for caching
import { useQuery } from '@tanstack/react-query';

const useSessionSearch = (filters) => {
  return useQuery({
    queryKey: ['sessions', filters],
    queryFn: () => searchSessions(filters),
    staleTime: 30000,  // API has 30s cache
    cacheTime: 300000  // Keep in cache for 5 minutes
  });
};
```

### 6. **Loading States**
```typescript
const [loading, setLoading] = useState(false);

const handleSearch = async () => {
  setLoading(true);
  try {
    await searchSessions(filters);
  } finally {
    setLoading(false);  // Always reset loading state
  }
};
```

---

## 📊 Default Behaviors Summary

| Parameter | When Empty/Null | Actual Behavior |
|-----------|----------------|-----------------|
| `statuses` | `[]` or null | Shows LIVE & DRAFT (excludes DELETED) |
| `session_ids` | `[]` or null | Shows all sessions |
| `start_date` | null | Shows from today |
| `end_date` | null | Shows next 1 month |
| `batch_ids` | `[]` | Shows all batches |
| `user_ids` | `[]` | Shows all users |
| `page` | undefined | Defaults to 0 |
| `size` | undefined | Defaults to 20 |
| `sort_by` | undefined | Defaults to `meetingDate` |
| `sort_direction` | undefined | Defaults to `ASC` |

---

## 🚫 Common Mistakes to Avoid

### ❌ Don't: Send null values explicitly
```typescript
// Bad
const filters = {
  institute_id: instituteId,
  statuses: null,       // Don't send null
  batch_ids: null       // Don't send null
};
```

### ✅ Do: Omit or send empty arrays
```typescript
// Good
const filters = {
  institute_id: instituteId
  // Omit fields entirely, or:
  // statuses: [],
  // batch_ids: []
};
```

### ❌ Don't: Use incorrect date formats
```typescript
// Bad
start_date: "10/25/2025"  // Wrong format
start_date: "25-10-2025"  // Wrong format
```

### ✅ Do: Use ISO date format
```typescript
// Good
start_date: "2025-10-25"  // YYYY-MM-DD
```

---

## 📱 Mobile/Responsive Considerations

```typescript
// Adjust page size for mobile
const isMobile = window.innerWidth < 768;

const getPageSize = () => {
  return isMobile ? 10 : 20;
};

// Infinite scroll example
const loadMore = async () => {
  const nextPage = pagination.current_page + 1;
  const newData = await searchSessions({
    ...currentFilters,
    page: nextPage
  });
  
  setSessions(prev => [...prev, ...newData.sessions]);
};
```

---

## 🔍 Testing Examples

```typescript
// Test with different filters
describe('Session Search API', () => {
  test('should fetch all upcoming sessions', async () => {
    const result = await searchSessions({
      institute_id: 'test-id'
    });
    expect(result.sessions).toBeDefined();
    expect(result.pagination).toBeDefined();
  });

  test('should filter by status', async () => {
    const result = await searchSessions({
      institute_id: 'test-id',
      statuses: ['LIVE']
    });
    result.sessions.forEach(session => {
      expect(['LIVE']).toContain(session.status);
    });
  });

  test('should search by text', async () => {
    const searchText = 'mathematics';
    const result = await searchSessions({
      institute_id: 'test-id',
      search_query: searchText
    });
    result.sessions.forEach(session => {
      const hasMatch = 
        session.title.toLowerCase().includes(searchText.toLowerCase()) ||
        session.subject.toLowerCase().includes(searchText.toLowerCase());
      expect(hasMatch).toBe(true);
    });
  });
});
```

---

## 📞 Support & Questions

If you encounter issues:
1. Check the request payload format
2. Verify authentication token is valid
3. Ensure `institute_id` is provided
4. Check browser console for errors
5. Review the comprehensive technical docs: `LIVE_SESSION_SEARCH_API_DOCUMENTATION.md`

**Happy Coding! 🚀**

