# Edit Mode API Flow Explanation

## What Happens When User Updates a Specific Day's Session

### Scenario
User opens edit mode and changes:
- Monday 7:00 AM: Changes link from `https://youtube.com/live/abc` to `https://youtube.com/live/xyz`
- Tuesday 6:00 AM: Changes start time from `06:00` to `06:30`

### Form Data Structure
Each session in the form contains an `id` that comes from the API:

```typescript
recurringSchedule: [
  {
    day: "Monday",
    isSelect: true,
    sessions: [
      {
        id: "94207579-eb72-429c-89c6-fd4f21783c60",  // ✅ ID from API
        startTime: "07:00",
        durationHours: "0",
        durationMinutes: "45",
        link: "https://youtube.com/live/xyz",  // CHANGED
        thumbnailFileId: "",
        countAttendanceDaily: false
      },
      // ... more sessions
    ]
  },
  {
    day: "Tuesday",
    isSelect: true,
    sessions: [
      {
        id: "701c9c81-efd1-4534-9856-aaf7f1451e32",  // ✅ ID from API
        startTime: "06:30",  // CHANGED from 06:00
        durationHours: "0",
        durationMinutes: "45",
        link: "https://youtube.com/live/YwbDhm4X4QA",
        thumbnailFileId: "",
        countAttendanceDaily: false
      },
      // ... more sessions
    ]
  }
]
```

### API Request Structure
When submitted, the data is transformed into this format:

```typescript
{
  "session_id": "555d20e2-880d-4802-b107-eae70776d1e0",
  "title": "Weekday | Aanandhyoga",
  "start_time": "2025-11-02T07:29:00",
  "session_end_date": "2025-11-05",
  "recurrence_type": "weekly",

  // Sessions with IDs should go here (UPDATES)
  "updated_schedules": [
    {
      "id": "94207579-eb72-429c-89c6-fd4f21783c60",
      "day": "monday",
      "start_time": "07:00:00",
      "duration": "45",
      "link": "https://youtube.com/live/xyz",  // Updated link
      "thumbnail_file_id": "",
      "daily_attendance": false
    },
    {
      "id": "701c9c81-efd1-4534-9856-aaf7f1451e32",
      "day": "tuesday",
      "start_time": "06:30:00",  // Updated time
      "duration": "45",
      "link": "https://youtube.com/live/YwbDhm4X4QA",
      "thumbnail_file_id": "",
      "daily_attendance": false
    }
    // ... ALL other existing sessions with their IDs
  ],

  // New sessions without IDs go here (ADDITIONS)
  "added_schedules": [
    // If user clicks "Add Session" button, new sessions appear here
  ],

  // IDs of sessions that were deleted
  "deleted_schedule_ids": [
    // If user removes a session, its ID goes here
  ]
}
```

## Current Implementation Logic

### From `helper.ts` (lines 163-207)

```typescript
if (meetingType === RecurringType.WEEKLY) {
    recurringSchedule.forEach((dayBlock: WeeklyClass) => {
        if (!dayBlock.isSelect) return;

        dayBlock.sessions.forEach((session) => {
            const baseSchedule: ScheduleDTO = {
                id: session.id,
                day: dayBlock.day,
                start_time: session.startTime ? `${session.startTime}:00` : '',
                duration: String(Number(session.durationHours) * 60 + Number(session.durationMinutes)),
                link: session.link || '',
                thumbnail_file_id: session.thumbnailFileId || '',
                daily_attendance: session.countAttendanceDaily || false,
            };

            // 🐛 BUG: Checking dayBlock.id which doesn't exist!
            if (dayBlock.id && originalScheduleMap.has(dayBlock.id)) {
                updated_schedules.push(baseSchedule);
                originalScheduleMap.delete(dayBlock.id);
            } else {
                added_schedules.push(baseSchedule);
            }
        });
    });
}
```

## 🐛 BUG IDENTIFIED!

### The Problem
**Line 189 checks `dayBlock.id`**, but `dayBlock` (the day object) **never has an `id` field**!

Looking at how we populate the form in edit mode (`scheduleStep1.tsx` lines 438-467):
```typescript
return {
    day: day.label,      // ✅ Has day
    isSelect: matchingSchedules.length > 0,  // ✅ Has isSelect
    sessions: matchingSchedules.map(...)     // ✅ Has sessions with IDs
    // ❌ NO id field on the day object itself!
};
```

### The Impact
Because `dayBlock.id` is always `undefined`, the condition on line 189 is always false:
```typescript
if (dayBlock.id && originalScheduleMap.has(dayBlock.id)) {
    updated_schedules.push(baseSchedule);  // ❌ NEVER REACHED
} else {
    added_schedules.push(baseSchedule);     // ✅ ALWAYS HAPPENS
}
```

**Result:** ALL sessions are sent as NEW (`added_schedules`) instead of UPDATES (`updated_schedules`), even in edit mode!

### The Correct Logic Should Be
```typescript
// Should check session.id, not dayBlock.id!
if (session.id) {
    // Has ID = existing session = UPDATE
    updated_schedules.push(baseSchedule);
} else {
    // No ID = new session = ADD
    added_schedules.push(baseSchedule);
}
```

## Backend Behavior (Likely)
The backend probably handles this gracefully:
- If a schedule in `added_schedules` has an `id`, it treats it as an update
- OR the backend uses the `id` field in the `ScheduleDTO` object directly

But the proper API contract should separate them into `added_schedules` vs `updated_schedules`.

## ✅ FIX APPLIED

### Updated Logic in `helper.ts` (lines 189-198)

```typescript
// Check if session has an ID - if yes, it's an update; if no, it's new
if (session.id) {
    updated_schedules.push(baseSchedule);
    // Remove from originalScheduleMap to track processed sessions
    if (originalScheduleMap.has(session.id)) {
        originalScheduleMap.delete(session.id);
    }
} else {
    added_schedules.push(baseSchedule);
}
```

### Now the Flow Works Correctly

#### Edit Mode - User Changes Monday 7:00 AM Link
1. **Form Data**: Session has `id: "94207579-eb72-429c-89c6-fd4f21783c60"`
2. **Transformation**: `if (session.id)` → TRUE
3. **API Request**: Goes to `updated_schedules` array ✅
4. **Backend**: Updates the existing session

#### Create Mode - User Adds New Session
1. **Form Data**: Session has `id: undefined` (no ID)
2. **Transformation**: `if (session.id)` → FALSE
3. **API Request**: Goes to `added_schedules` array ✅
4. **Backend**: Creates a new session

#### Edit Mode - User Deletes a Session
1. **Form Data**: Session is removed from form
2. **Transformation**: Session ID not found in form data
3. **API Request**: ID goes to `deleted_schedule_ids` array ✅
4. **Backend**: Deletes the session

### Impact of the Fix
- ✅ Edit mode now correctly sends existing sessions as UPDATES instead of duplicating them
- ✅ Backend receives proper separation of added vs updated schedules
- ✅ Follows the API contract properly
- ✅ Prevents potential issues with duplicate session creation

