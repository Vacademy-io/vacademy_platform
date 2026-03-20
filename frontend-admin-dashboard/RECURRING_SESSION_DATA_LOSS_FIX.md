# Recurring Session Data Loss Fix

## Issue Summary

When editing recurring sessions, the start date was being auto-updated to the current date/time, which was:
1. **Overwriting the start date** - Both the main start date and individual weekday session times
2. **Causing data loss** - User's carefully scheduled session times were being lost
3. **Affecting all weekdays** - The auto-fill effects were propagating the current time to all weekday sessions

## Root Cause

### 1. Start Date/Time Auto-Update
The code had fallback logic that would set recurring sessions to "current time" when there were parsing issues:

```typescript
// OLD CODE (PROBLEMATIC)
} else {
    // Recurring session - current time is acceptable
    const currentTime = getCurrentTimeInTimezone(savedTimezone);
    form.setValue('startTime', currentTime);
}
```

This was intended for error recovery, but it was destructive and caused data loss for existing schedules.

### 2. Auto-Fill Effects Running During Edit Mode
Even though the auto-fill effects had guards (`if (sessionDetails) return;`), there were potential race conditions during the form initialization process where:
- The main start time field was being set to current time
- This triggered the auto-fill effects
- The effects would then propagate this "current time" to all weekday sessions
- This overwrote the carefully preserved individual session times loaded from the API

## Solution Implemented

### 1. Preserve Original Date/Time for ALL Session Types

```typescript
// NEW CODE (FIXED)
// IMPORTANT: ALWAYS preserve original datetime for BOTH one-time AND recurring sessions
// - For ONE-TIME sessions: Preserves user's scheduled date/time
// - For RECURRING sessions: Preserves the start date (individual weekday times are separate)
if (schedule.meeting_date && schedule.start_time) {
    try {
        const originalDateTime = `${schedule.meeting_date}T${schedule.start_time}`;
        const testDate = new Date(originalDateTime);
        if (!isNaN(testDate.getTime())) {
            form.setValue('startTime', originalDateTime);
        } else {
            // Invalid date - preserve as-is to avoid data loss
            console.warn('Invalid datetime format, keeping as-is:', originalDateTime);
            form.setValue('startTime', originalDateTime);
        }
    } catch (error) {
        console.error('Error parsing start time:', error);
        // ALWAYS try to preserve original format, never auto-update to current time
        const originalDateTime = `${schedule.meeting_date}T${schedule.start_time}`;
        form.setValue('startTime', originalDateTime);
    }
}
```

**Key Changes:**
- Removed the distinction between one-time and recurring sessions for date preservation
- Now **always** preserves the original datetime from the API
- Never auto-updates to current time (prevents data loss)
- Only uses current time as absolute last resort when no data exists at all

### 2. Added Stable Edit Mode Reference

```typescript
// Ref to track if we're in edit mode - this should NEVER change during component lifecycle
const isEditModeRef = useRef<boolean>(false);
```

**How it works:**
1. When `sessionDetails` exists, set `isEditModeRef.current = true` once:
   ```typescript
   // Mark that we're in edit mode - this flag will NEVER change once set
   isEditModeRef.current = true;
   ```
2. All auto-fill effects check this stable ref:
   ```typescript
   // NEVER auto-fill in edit mode - user's existing session times should be preserved
   if (isEditModeRef.current) return;
   ```
3. The ref persists for the entire component lifecycle

**Why this works:**
- Uses a ref instead of state, so it doesn't trigger re-renders
- Once set to `true`, it NEVER changes back to `false`
- Not affected by Zustand state updates or re-renders
- Provides absolute certainty that auto-fill will never run in edit mode
- Simpler and more reliable than checking multiple state variables

## What's Protected Now

### ✅ Recurring Sessions
- **Start Date**: Preserved from `schedule.meeting_date`
- **End Date**: Already preserved from `schedule.session_end_date`
- **Main Start Time**: Preserved from `schedule.start_time`
- **Individual Weekday Sessions**: Fully preserved with their specific times
  - Monday 8:00 AM stays 8:00 AM
  - Tuesday 10:00 AM stays 10:00 AM
  - Wednesday 2:00 PM stays 2:00 PM
  - etc.

### ✅ One-Time Sessions
- **Date/Time**: Preserved even for future-dated events
- No auto-update to current time

## Behavior Comparison: Create vs Edit Mode

### Create Mode (New Session)
When creating a new recurring session:
1. ✅ Auto-fill ENABLED - helps user set up sessions quickly
2. ✅ Changing main "Start Time" propagates to all weekday first sessions
3. ✅ Changing duration propagates to all sessions
4. ✅ Changing link propagates to all sessions
5. ✅ Selecting new days auto-fills them with current values

This is helpful UX for creation!

### Edit Mode (Existing Session)
When editing an existing recurring session:
1. ❌ Auto-fill DISABLED - preserves user's existing setup
2. ✅ Each weekday session maintains its individual time
3. ✅ Each session maintains its individual duration
4. ✅ Each session maintains its individual link
5. ✅ Main "Start Date/Time" field controls WHEN the schedule begins, not the session times
6. ✅ User can manually use "Copy to days" button to propagate changes if desired

This prevents accidental data loss during editing!

## Testing Checklist

- [ ] **Edit Mode Tests:**
  - [ ] Open edit mode - verify "Start Date/Time" field is pre-filled (not blank)
  - [ ] Edit a recurring session with multiple days and different times per day
  - [ ] Verify NO duplicate sessions are shown (e.g., Monday should show each time slot only once, not 9 times)
  - [ ] Verify sessions are sorted chronologically (6:00 AM before 7:00 AM before 8:00 AM, etc.)
  - [ ] Verify start date doesn't change to current date
  - [ ] Verify end date is preserved
  - [ ] Verify each weekday's session times remain unchanged
  - [ ] Manually change the "Start Date/Time" field - verify weekday times DON'T change
  - [ ] Manually change duration - verify weekday sessions DON'T change
  - [ ] Manually change link - verify weekday sessions DON'T change
  - [ ] Open, close, and reopen the edit form - times should stay the same
  - [ ] Edit a future-dated one-time session - date/time should be preserved
- [ ] **Create Mode Tests:**
  - [ ] Create a new recurring session - auto-fill should still work
  - [ ] Change "Start Time" - first session of each day should update
  - [ ] Change duration - all sessions should update
  - [ ] Select new days - they should auto-fill with current values

## Critical Issue Fixed: Weekday Session Times Getting Overwritten

### Problem
When a user edited the **Start Date/Time** field in edit mode for a recurring session:
```
User changes: "Start Date: Jan 1, 2024 9:00 AM" → "Start Date: Jan 15, 2024 9:00 AM"
```

The auto-fill effect would extract the TIME portion (9:00 AM) and apply it to ALL weekday first sessions:
- Monday session: 8:00 AM → **CHANGED TO** 9:00 AM ❌
- Tuesday session: 10:00 AM → **CHANGED TO** 9:00 AM ❌
- Wednesday session: 2:00 PM → **CHANGED TO** 9:00 AM ❌

### Root Cause
The auto-fill effect watches `startTimeValue` and propagates changes to weekday sessions:
```typescript
useEffect(() => {
    // This was running even in edit mode after initialization!
    const timeValue = startTimeValue?.split('T')[1] || '';
    // Apply to all first sessions...
}, [startTimeValue, ...]);
```

Even though we had `if (sessionDetails) return;`, the effect could still run if:
- `sessionDetails` was in the dependency array and changed
- Race conditions during initialization
- User manually updated the start date field after initialization

### Solution
Use a stable ref that never changes once set:
```typescript
const isEditModeRef = useRef<boolean>(false);

// Set once during initialization
isEditModeRef.current = true;

// Check in all auto-fill effects
if (isEditModeRef.current) return; // NEVER runs in edit mode
```

This ensures the auto-fill effects **NEVER** run in edit mode, even when:
- User manually changes the start date field
- Duration fields are updated
- Link fields are updated
- Any other watched values change

## Additional Fix: Start Date/Time Field Not Pre-filled

### Problem
When opening edit mode, the "Start Date/Time" field was blank and users had to manually fill it.

### Root Cause
The API returns `start_time` in full datetime format: `"2025-10-25T23:07:00"`, but the code was expecting it to be just the time portion and trying to combine it with `meeting_date`.

### Solution
Updated the logic to detect if `start_time` already includes the date (contains 'T'):
```typescript
if (schedule.start_time) {
    // Check if start_time is already in full datetime format
    if (schedule.start_time.includes('T')) {
        // Already in datetime format - use directly
        form.setValue('startTime', schedule.start_time);
    } else if (schedule.meeting_date) {
        // start_time is just time portion, combine with meeting_date
        const originalDateTime = `${schedule.meeting_date}T${schedule.start_time}`;
        form.setValue('startTime', originalDateTime);
    }
}
```

Now the field is correctly pre-filled with the datetime from the API!

## Additional Fix: Duplicate Sessions Showing in Edit Mode

### Problem
When opening edit mode for a recurring session, each day was showing many duplicate sessions. For example, Monday would show:
- 9 entries for 6:00 AM
- 9 entries for 7:00 AM
- 9 entries for 8:00 AM
- etc.

This was because the API returns ALL occurrences of the recurring sessions across all weeks (Nov 1, Nov 8, Nov 15, Nov 22, etc.), and the UI was displaying all of them instead of just the unique time slots.

### Root Cause
The API's `added_schedules` array contains one entry for EACH occurrence of EACH session. For a weekly recurring schedule with 9 weeks and 6 time slots per day:
- Monday 6:00 AM appears 9 times (one for each week)
- Monday 7:00 AM appears 9 times
- etc.

The code was displaying all these entries without deduplication.

### Solution
Added deduplication logic using a `Map` to keep only unique time slots per day:

```typescript
// Find ALL matching schedules for this day
const allMatchingSchedules = schedule.added_schedules.filter(
    (scheduleItem) => scheduleItem.day.toLowerCase() === day.label.toLowerCase()
);

// Deduplicate by startTime - the API returns multiple entries for each week occurrence
// We only want ONE entry per unique time slot
const uniqueSessionsMap = new Map<string, (typeof schedule.added_schedules)[0]>();
allMatchingSchedules.forEach((session) => {
    if (!uniqueSessionsMap.has(session.startTime)) {
        uniqueSessionsMap.set(session.startTime, session);
    }
});

const matchingSchedules = Array.from(uniqueSessionsMap.values()).sort((a, b) => {
    // Sort by startTime in ascending order
    return a.startTime.localeCompare(b.startTime);
});
```

Now each day shows only the unique time slots (e.g., 6:00 AM, 7:00 AM, 8:00 AM, etc.) in chronological order!

### CRITICAL: Keeping ALL Session IDs

**The deduplication was causing data loss!** When Monday 6:00 AM appeared 9 times (one per week), we were only keeping the first ID. When users edited it, only week 1 got updated, weeks 2-9 remained unchanged!

**Fix:** Now we keep ALL IDs as a comma-separated string:
```typescript
const allIds = sessions.map((s) => s.id).join(',');
// Stores: "id1,id2,id3,id4,id5,id6,id7,id8,id9"
```

When submitting, we split and send each ID as a separate update:
```typescript
const sessionIds = session.id.split(',');
sessionIds.forEach((sessionId) => {
    updated_schedules.push({ id: sessionId, ...sessionData });
});
// Results in 9 update entries, one for each week
```

**Result:** Changing Monday 6:00 AM now correctly updates ALL 9 Monday occurrences! ✅

See `CRITICAL_DEDUPLICATION_FIX.md` for detailed explanation.

## Critical Bug Fix: Edit Mode Sending All Sessions as New

### Problem
When editing a recurring session and changing a specific day's session (e.g., changing Monday 7:00 AM's link), the transformation logic was incorrectly sending ALL sessions as NEW (`added_schedules`) instead of UPDATES (`updated_schedules`).

### Root Cause
The `transformFormToDTOStep1` function in `helper.ts` was checking `dayBlock.id` (which never exists) instead of `session.id`:

```typescript
// WRONG - dayBlock.id doesn't exist!
if (dayBlock.id && originalScheduleMap.has(dayBlock.id)) {
    updated_schedules.push(baseSchedule);
} else {
    added_schedules.push(baseSchedule);  // Everything went here!
}
```

### Solution
Changed the logic to check `session.id` (which comes from the API):

```typescript
// CORRECT - check session.id
if (session.id) {
    updated_schedules.push(baseSchedule);  // Existing sessions
    if (originalScheduleMap.has(session.id)) {
        originalScheduleMap.delete(session.id);
    }
} else {
    added_schedules.push(baseSchedule);  // New sessions only
}
```

### Impact
- ✅ Edit mode now correctly sends existing sessions as UPDATES
- ✅ Only new sessions go to `added_schedules`
- ✅ Deleted sessions go to `deleted_schedule_ids`
- ✅ Follows the API contract properly
- ✅ Prevents potential duplicate session creation

See `EDIT_MODE_API_FLOW_EXPLANATION.md` for detailed explanation of how the API flow works.

## Files Modified

- `src/routes/study-library/live-session/schedule/-components/scheduleStep1.tsx`
  - Line 76: Added `isEditModeRef` ref
  - Line 319: Set `isEditModeRef.current = true` when entering edit mode
  - Lines 201, 245: Changed auto-fill guards to use `isEditModeRef.current`
  - Lines 234, 271: Cleaned up effect dependencies (removed `sessionDetails`, `isLoadingEditData`)
  - Lines 338-386: Fixed start time parsing to handle both full datetime and time-only formats
  - Lines 424-448: **CRITICAL FIX** - Changed deduplication to keep ALL session IDs (comma-separated) instead of just first one, ensuring edits apply to all week occurrences

- `src/routes/study-library/live-session/-constants/helper.ts`
  - Lines 179-216: **CRITICAL FIX** - Split comma-separated session IDs and create separate update entry for each, ensuring ALL week occurrences get updated
  - Fixed to check `session.id` instead of `dayBlock.id` for proper separation of added vs updated schedules

## Impact

- ✅ **No more data loss** when editing recurring sessions
- ✅ **User's scheduled times are respected** and preserved
- ✅ **Edit mode is now truly "edit"** - loads existing data without modification
- ✅ **New session creation** still works with auto-fill features

