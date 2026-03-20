# Live Session Search API - Testing Guide

## Quick Start Testing

### 1. Basic Tab Navigation
```
✓ Open Live Session page
✓ Click "Live" tab - should show live sessions for today
✓ Click "Upcoming" tab - should show future sessions (from tomorrow onwards)
✓ Click "Past" tab - should show historical sessions (until yesterday)
✓ Click "Drafts" tab - should show draft sessions
```

### 2. Search Functionality
```
✓ Type "math" in search box
✓ Results should update automatically
✓ Should search in both title and subject fields
✓ Clear search - all sessions should return
```

### 3. Date Filtering
```
✓ Click "Select date range" button
✓ Select a custom date range
✓ Sessions should filter to that range
✓ Try quick presets: "Today", "Past Week", "Next Week"
✓ Verify sessions match selected dates
```

### 4. Time of Day Filtering
```
✓ Click "Time of Day" filter
✓ Set start time: 09:00
✓ Set end time: 17:00
✓ Should show only sessions starting between 9 AM and 5 PM
✓ Clear by clicking "Clear All"
```

### 5. Meeting Type Filter
```
✓ Click "Meeting Type" dropdown
✓ Select "Once"
✓ Should show only one-time sessions
✓ Select "Weekly"
✓ Should show recurring weekly sessions
```

### 6. Subject Filter
```
✓ Click "Subject" dropdown
✓ Select a subject from the list
✓ Should filter sessions by that subject
✓ Note: Currently uses search, may need backend enhancement
```

### 7. Access Type Filter
```
✓ Click "Access Type" dropdown
✓ Select "Public"
✓ Should show only public sessions
✓ Select "Private"
✓ Should show only private sessions
```

### 8. Streaming Platform Filter
```
✓ Click "Platform" dropdown
✓ Select "Zoom"
✓ Should filter to Zoom sessions only
✓ Try "Google Meet", "YouTube", "Other"
```

### 9. Pagination
```
✓ If more than 10 sessions, pagination should appear
✓ Click "Next" page
✓ Different sessions should load
✓ Page number should update
✓ Click "Previous" to go back
✓ Should return to first page content
```

### 10. Combined Filters
```
✓ Set search: "test"
✓ Set date range: Last week
✓ Set meeting type: Weekly
✓ All filters should work together
✓ Results should match ALL criteria
```

### 11. Clear Filters
```
✓ Apply multiple filters
✓ Click "Clear All" button
✓ All filters should reset
✓ Full session list should return
```

### 12. Empty States
```
✓ Apply filters that return no results
✓ Should show "No [Tab] Sessions" message
✓ Icon and descriptive text should appear
✓ No error messages
```

## API Request Examples

### Example 1: Live Sessions for Today
```json
POST /admin-core-service/get-sessions/search
{
  "institute_id": "your-institute-id",
  "statuses": ["LIVE"],
  "page": 0,
  "size": 10,
  "sort_by": "meetingDate",
  "sort_direction": "ASC"
}
```

Expected Response:
- Sessions happening TODAY in their respective timezones
- Paginated results
- Pagination metadata included

### Example 2: Upcoming Sessions with Search
```json
{
  "institute_id": "your-institute-id",
  "statuses": ["LIVE"],
  "start_date": "2025-10-26",
  "search_query": "mathematics",
  "page": 0,
  "size": 10
}
```

Expected Response:
- Sessions from tomorrow onwards
- Title or subject contains "mathematics"
- Sorted by meeting date

### Example 3: Past Sessions with Multiple Filters
```json
{
  "institute_id": "your-institute-id",
  "statuses": ["LIVE"],
  "end_date": "2025-10-24",
  "recurrence_types": ["WEEKLY"],
  "access_levels": ["PUBLIC"],
  "start_time_of_day": "09:00:00",
  "end_time_of_day": "17:00:00",
  "streaming_service_types": ["ZOOM"],
  "page": 0,
  "size": 10
}
```

Expected Response:
- Past sessions (until yesterday)
- Weekly recurring only
- Public access only
- Starting between 9 AM and 5 PM
- Using Zoom platform

## Browser DevTools Testing

### Network Tab
1. Open DevTools → Network tab
2. Filter by "search" to see API calls
3. Verify:
   - POST request to `/get-sessions/search`
   - Request payload matches selected filters
   - Response contains sessions array and pagination
   - Status code 200

### React DevTools
1. Install React DevTools extension
2. Find `SessionListPage` component
3. Verify:
   - `searchRequest` state updates with filters
   - `searchResponse` contains API data
   - `currentPage` resets to 0 on filter change
   - No unnecessary re-renders

### Console Errors
1. Open Console tab
2. Perform all test actions
3. Verify:
   - No error messages
   - No warning about missing dependencies
   - No failed API calls

## Edge Cases to Test

### 1. Network Errors
```
✓ Disconnect internet
✓ Try to load sessions
✓ Should show error message
✓ Reconnect and try again
✓ Should load successfully
```

### 2. Very Long Session Lists
```
✓ Institute with 100+ sessions
✓ Pagination should work smoothly
✓ Page numbers should be correct
✓ No performance issues
```

### 3. Special Characters in Search
```
✓ Search: "Test & Demo"
✓ Search: "Math's Class"
✓ Search: "C++ Programming"
✓ Should handle special characters
✓ No errors in console
```

### 4. Rapid Filter Changes
```
✓ Quickly change multiple filters
✓ Type search query rapidly
✓ Switch tabs quickly
✓ Should debounce appropriately
✓ No race conditions
```

### 5. Date Edge Cases
```
✓ Start date = End date (single day)
✓ Start date > End date (invalid range)
✓ Very old dates
✓ Far future dates
✓ Leap year dates
```

### 6. Timezone Testing
```
✓ Sessions with different timezones
✓ Verify "Live" sessions match current time in their timezone
✓ Session at midnight
✓ Session spanning multiple days
```

### 7. Empty Institute
```
✓ New institute with no sessions
✓ Should show empty state
✓ "Schedule" button should be visible
✓ No errors
```

## Performance Benchmarks

### Expected Response Times
- Initial load: < 1 second
- Filter change: < 500ms
- Pagination: < 300ms
- Search (with typing): Immediate visual feedback

### Expected Behavior
- Smooth scrolling
- No UI freezing
- Instant filter visual updates
- Quick API responses

## Common Issues and Solutions

### Issue: Filters not working
**Check:**
- Browser console for errors
- Network tab for failed requests
- Request payload matches expected format

### Issue: Pagination not appearing
**Check:**
- Total sessions < page size (10)
- `searchResponse.pagination.total_pages > 1`
- Console for rendering errors

### Issue: Empty results unexpectedly
**Check:**
- Applied filters are too restrictive
- Date range is valid
- Backend has sessions matching criteria
- Timezone considerations

### Issue: Search not finding sessions
**Check:**
- Search is case-insensitive
- Searches in title AND subject
- Try exact title/subject text
- Check for special characters

## Regression Testing Checklist

Before deploying to production:

- [ ] All tabs load correctly
- [ ] All filters work individually
- [ ] All filters work in combination
- [ ] Pagination works on all tabs
- [ ] Search works across title and subject
- [ ] Date range presets work correctly
- [ ] Time of day filter works
- [ ] Clear filters resets everything
- [ ] Empty states show appropriate messages
- [ ] Loading states appear during API calls
- [ ] Error states show on network failures
- [ ] Session cards display correctly
- [ ] Schedule button navigates correctly
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] No layout issues on different screen sizes
- [ ] Works on Chrome, Firefox, Safari, Edge

## Automated Testing (Future)

### Unit Tests Needed
```typescript
// Filter building logic
test('builds correct search request for Live tab', () => {
  const request = buildSearchRequest('Live', filters);
  expect(request.statuses).toEqual(['LIVE']);
  expect(request.start_date).toBeUndefined();
});

// Date handling
test('sets start_date to tomorrow for Upcoming tab', () => {
  const request = buildSearchRequest('Upcoming', {});
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  expect(request.start_date).toBe(tomorrow);
});
```

### Integration Tests Needed
```typescript
// API integration
test('fetches live sessions successfully', async () => {
  const { result } = renderHook(() => useSessionSearch(request));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data?.sessions).toBeDefined();
});

// User interactions
test('updates results when search query changes', async () => {
  render(<SessionListPage />);
  const searchInput = screen.getByPlaceholderText('Search sessions...');
  await userEvent.type(searchInput, 'math');
  await waitFor(() => {
    expect(screen.getByText(/math/i)).toBeInTheDocument();
  });
});
```

## Success Criteria

The implementation is successful if:

1. ✅ All filters work correctly
2. ✅ Pagination handles large datasets
3. ✅ Performance is acceptable (< 1s load time)
4. ✅ No console errors
5. ✅ Timezone handling is correct
6. ✅ Empty and error states work
7. ✅ Mobile responsive design works
8. ✅ All tabs show appropriate sessions
9. ✅ Search finds relevant sessions
10. ✅ Clear filters resets completely

## Contact

If you encounter issues during testing:
1. Check console for errors
2. Verify API endpoint is correct
3. Check network requests in DevTools
4. Review this guide for expected behavior
5. Contact backend team if API issues suspected

