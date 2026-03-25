# Batch Filter Implementation

## Overview
Added multi-select batch filter to the Live Session list page, allowing users to filter sessions by package_session_id (batches).

## Changes Made

### 1. Updated Imports (`sessions-list-page.tsx`)
```typescript
import SelectChips, { SelectOption } from '@/components/design-system/SelectChips';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
```

### 2. Added Batch Filter State
```typescript
const AllBatchesOption: SelectOption = {
    label: 'All Batches',
    value: 'all',
};

// Inside component:
const { instituteDetails: storeInstituteDetails } = useInstituteDetailsStore();

// Build batch options from institute details
const batchOptions = useMemo(() => {
    const batches =
        storeInstituteDetails?.batches_for_sessions?.map((batch) => ({
            label: `${batch.level.level_name} ${batch.package_dto.package_name}, ${batch.session.session_name}`,
            value: batch.id, // This is the package_session_id
        })) || [];
    return [AllBatchesOption, ...batches];
}, [storeInstituteDetails?.batches_for_sessions]);

const [selectedBatches, setSelectedBatches] = useState<SelectOption[]>([AllBatchesOption]);
```

### 3. Updated Search Request Builder
```typescript
// Apply batch filter
if (selectedBatches.length > 0 && !selectedBatches.some((b) => b.value === 'all')) {
    baseRequest.batch_ids = selectedBatches.map((b) => b.value);
}
```

### 4. Added Batch Filter UI Component
```tsx
{/* Batch Filter */}
<div className="w-[220px]">
    <SelectChips
        options={batchOptions}
        selected={selectedBatches}
        onChange={handleBatchChange}
        placeholder="Select Batches"
        multiSelect={true}
        hasClearFilter={false}
        className="h-9"
    />
</div>
```

### 5. Updated Clear Filters Function
```typescript
const clearFilters = () => {
    // ... other filters
    setSelectedBatches([AllBatchesOption]);
    // ... rest
};
```

### 6. Added Batch Change Handler
```typescript
const handleBatchChange = (batches: SelectOption[]) => {
    if (batches.length > 0) {
        setSelectedBatches(batches);
        setCurrentPage(0); // Reset to first page on filter change
    }
};
```

## How It Works

### Batch Selection
1. **All Batches (Default)**: When "All Batches" is selected, no `batch_ids` filter is sent to API
2. **Specific Batches**: When specific batches are selected, their IDs are sent as `batch_ids` array
3. **Multi-Select**: Users can select multiple batches simultaneously
4. **No Clear Option**: `hasClearFilter={false}` ensures at least one option is always selected

### Display Format
Batches are displayed in the format:
```
"Level Name Package Name, Session Name"
```
Example: `"Grade 10 Mathematics, Spring 2025"`

### API Integration
When specific batches are selected:
```typescript
{
  institute_id: "inst-123",
  batch_ids: ["batch-uuid-1", "batch-uuid-2"],
  // ... other filters
}
```

### Filter Behavior
- **Persists across tabs**: Batch filter remains when switching between Live/Upcoming/Past/Drafts tabs
- **Resets pagination**: Changing batch selection resets to page 1
- **Cleared with "Clear All"**: "Clear All" button resets to "All Batches"
- **Works with other filters**: Combines with date, search, subject, and other filters

## Data Source
- Batches are fetched from `useInstituteDetailsStore()` → `instituteDetails.batches_for_sessions`
- Data structure:
```typescript
{
  id: string,                    // package_session_id
  level: { level_name: string },
  package_dto: { package_name: string },
  session: { session_name: string }
}
```

## UI/UX Features

### SelectChips Component Features
- **Multi-select**: Checkbox interface for selecting multiple batches
- **Search**: Built-in search to find batches quickly
- **Compact Display**: Shows "X selected" when multiple batches chosen
- **No Clear Option**: `hasClearFilter={false}` prevents empty selection
- **Dropdown UI**: Clean dropdown with Command component

### Visual States
- Selected batches show with checkmarks
- "All Batches" option at the top
- Searchable list of all available batches
- Compact display showing count when multiple selected

## Testing Checklist

### Basic Functionality
- [ ] "All Batches" is selected by default
- [ ] Can select multiple batches
- [ ] Can deselect batches
- [ ] "All Batches" option works correctly
- [ ] Search within batch list works
- [ ] Selected batches display correctly

### Integration
- [ ] API receives correct batch_ids array
- [ ] Works with other filters (date, search, etc.)
- [ ] Persists when switching tabs
- [ ] Resets with "Clear All" button
- [ ] Resets pagination on change

### Edge Cases
- [ ] Works with no batches (new institute)
- [ ] Works with single batch
- [ ] Works with 100+ batches
- [ ] Search handles special characters
- [ ] UI remains responsive with many selections

## Example Use Cases

### Filter by Single Batch
1. Open batch filter dropdown
2. Unselect "All Batches"
3. Select "Grade 10 Mathematics, Spring 2025"
4. Sessions filtered to that batch only

### Filter by Multiple Batches
1. Open batch filter dropdown
2. Unselect "All Batches"
3. Select multiple batches (e.g., "Grade 9 Science" and "Grade 10 Math")
4. Sessions filtered to those batches only

### Return to All Batches
1. Click "Clear All" button
2. Or select "All Batches" option in dropdown
3. All sessions shown again (subject to other filters)

### Combined Filters
1. Select specific batches
2. Add date range filter
3. Add search query
4. All filters work together (AND logic)
5. Shows sessions matching ALL criteria

## API Request Examples

### With Specific Batches
```json
POST /admin-core-service/get-sessions/search
{
  "institute_id": "inst-123",
  "batch_ids": ["batch-uuid-1", "batch-uuid-2"],
  "statuses": ["LIVE"],
  "page": 0,
  "size": 10
}
```

### With All Batches (No filter)
```json
POST /admin-core-service/get-sessions/search
{
  "institute_id": "inst-123",
  "statuses": ["LIVE"],
  "page": 0,
  "size": 10
  // Note: no batch_ids field
}
```

### Combined with Other Filters
```json
POST /admin-core-service/get-sessions/search
{
  "institute_id": "inst-123",
  "batch_ids": ["batch-uuid-1"],
  "start_date": "2025-10-25",
  "end_date": "2025-11-25",
  "search_query": "mathematics",
  "access_levels": ["PRIVATE"],
  "page": 0,
  "size": 10
}
```

## Implementation Notes

### Why SelectChips?
- Consistent with existing codebase patterns (see doubt-management, attendance-tracker)
- Built-in multi-select functionality
- Search capability included
- Clean, modern UI

### Why "All Batches" Option?
- Provides clear default state
- Easy way to show all sessions
- Prevents confusion about empty state
- Consistent with other filter patterns in codebase

### Why hasClearFilter={false}?
- Ensures at least one option is always selected
- Prevents confusion about what "no selection" means
- Following pattern from doubt-management batch filter

### State Management
- Batch options built from zustand store (`useInstituteDetailsStore`)
- Selected batches in local component state
- Automatically updates when institute details change
- useMemo prevents unnecessary re-computation

## Future Enhancements

### Possible Improvements
1. **Batch Groups**: Group batches by session or level
2. **Batch Info**: Show batch metadata (student count, instructor)
3. **Recent Batches**: Show recently filtered batches at top
4. **Saved Filters**: Save common batch filter combinations
5. **Batch Status**: Show active/inactive status
6. **Quick Filters**: "My Batches" or "Active Batches" shortcuts

### User Feedback Integration
- Monitor usage to see which batches are filtered most
- Consider adding batch popularity indicators
- Potentially add batch recommendations based on history

## Related Files Modified
- `/src/routes/study-library/live-session/-components/sessions-list-page.tsx` - Main implementation
- No new files created
- Uses existing components and stores

## Dependencies
- `@/components/design-system/SelectChips` - Multi-select component
- `@/stores/students/students-list/useInstituteDetailsStore` - Batch data source
- No new dependencies added

## Performance Considerations
- Batch list computed with `useMemo` for efficiency
- Only fetches institute details once (from store)
- No additional API calls for batch data
- Filter updates trigger single API call to search endpoint

## Accessibility
- Keyboard navigation supported (via SelectChips)
- Screen reader compatible
- Clear labels and states
- Focus management handled by component

## Browser Compatibility
- Works in all modern browsers
- Same compatibility as SelectChips component
- No special browser requirements

## Migration Notes
- No breaking changes
- Existing sessions continue to work
- Filter is optional (defaults to "All Batches")
- Backward compatible with sessions without batch assignments

