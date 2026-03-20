# Critical Fix: Deduplication Losing Session IDs

## The Critical Problem Discovered

When deduplicating sessions for display, we were **losing session IDs**, causing updates to only affect ONE week instead of ALL weeks!

### The Issue in Detail

**API Returns:** 9 entries for Monday 6:00 AM (one for each week)
```json
[
  { "id": "94207579-...", "day": "monday", "startTime": "06:00", "link": "old-link" },  // Week 1
  { "id": "d3df5611-...", "day": "monday", "startTime": "06:00", "link": "old-link" },  // Week 2
  { "id": "4f5a14bc-...", "day": "monday", "startTime": "06:00", "link": "old-link" },  // Week 3
  // ... 6 more entries for weeks 4-9
]
```

**OLD CODE - Only Kept First ID:**
```typescript
const uniqueSessionsMap = new Map<string, Session>();
allMatchingSchedules.forEach((session) => {
    if (!uniqueSessionsMap.has(session.startTime)) {
        uniqueSessionsMap.set(session.startTime, session);  // Only first one!
    }
});
```

**Result:**
- UI shows ONE field for Monday 6:00 AM ✅
- Form stores only ONE ID: "94207579-..." ❌
- User changes link to "new-link"
- API receives update for ONLY ID "94207579-..." ❌
- **Only Week 1 gets updated!** Weeks 2-9 still have "old-link" ❌❌❌

### The Solution

**NEW CODE - Keep ALL IDs:**
```typescript
// Group ALL sessions by time
const sessionsByTime = new Map<string, Array<Session>>();
allMatchingSchedules.forEach((session) => {
    if (!sessionsByTime.has(session.startTime)) {
        sessionsByTime.set(session.startTime, []);
    }
    sessionsByTime.get(session.startTime)!.push(session);  // Keep ALL!
});

// Store ALL IDs as comma-separated string
const matchingSchedules = Array.from(sessionsByTime.entries())
    .map(([startTime, sessions]) => {
        const allIds = sessions.map((s) => s.id).join(',');
        return {
            ...sessions[0],  // Use first session's data for display
            id: allIds,      // Store ALL IDs: "id1,id2,id3,id4,id5,id6,id7,id8,id9"
        };
    });
```

**Transformation - Split and Send Each ID:**
```typescript
if (session.id) {
    // Split comma-separated IDs
    const sessionIds = session.id.split(',').filter((id) => id.trim());
    
    // Create update for EACH ID
    sessionIds.forEach((sessionId) => {
        updated_schedules.push({
            id: sessionId.trim(),
            day: dayBlock.day,
            start_time: session.startTime,
            duration: duration,
            link: session.link,  // Same link for all occurrences
            // ... other fields
        });
    });
}
```

**Result:**
- UI shows ONE field for Monday 6:00 AM ✅
- Form stores ALL IDs: "id1,id2,id3,id4,id5,id6,id7,id8,id9" ✅
- User changes link to "new-link"
- API receives 9 separate updates (one for each ID) ✅
- **All 9 weeks get updated to "new-link"!** ✅✅✅

## Before vs After

### Before (BROKEN) 💔

```
User edits Monday 6:00 AM link → API Request:
{
  "updated_schedules": [
    { "id": "94207579-...", "link": "new-link" }  // Only 1 entry!
  ]
}

Result: Only Week 1 updated, Weeks 2-9 unchanged ❌
```

### After (FIXED) ✅

```
User edits Monday 6:00 AM link → API Request:
{
  "updated_schedules": [
    { "id": "94207579-...", "link": "new-link" },  // Week 1
    { "id": "d3df5611-...", "link": "new-link" },  // Week 2
    { "id": "4f5a14bc-...", "link": "new-link" },  // Week 3
    { "id": "90cddc22-...", "link": "new-link" },  // Week 4
    { "id": "926be9e4-...", "link": "new-link" },  // Week 5
    { "id": "652d6282-...", "link": "new-link" },  // Week 6
    { "id": "b6ee4495-...", "link": "new-link" },  // Week 7
    { "id": "c944e33a-...", "link": "new-link" },  // Week 8
    { "id": "8f3fae1c-...", "link": "new-link" }   // Week 9
  ]
}

Result: ALL 9 weeks updated ✅
```

## Files Modified

- **`scheduleStep1.tsx` (lines 424-448)**
  - Changed from storing single session to grouping by time
  - Store all IDs as comma-separated string

- **`helper.ts` (lines 179-216)**
  - Split comma-separated IDs
  - Create separate update entry for each ID
  - Ensures ALL week occurrences get updated

## Impact

- ✅ Edits now correctly apply to **ALL weeks** of a recurring session
- ✅ Changing Monday 6:00 AM link updates all 9 Mondays (or however many weeks exist)
- ✅ No data loss - all session IDs preserved
- ✅ Clean UI - still shows only one field per time slot
- ✅ Proper behavior - one change affects all occurrences as expected

## Testing Checklist

- [ ] Create a recurring session for 4 weeks with Monday 6:00 AM
- [ ] Open edit mode - verify Monday shows only ONE 6:00 AM field
- [ ] Change the link for Monday 6:00 AM
- [ ] Submit the form
- [ ] Verify in backend/database that ALL 4 Monday 6:00 AM sessions have the new link
- [ ] Verify weeks 1, 2, 3, and 4 all show the updated link in the live session list

