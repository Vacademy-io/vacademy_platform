# Live Session Schedule Update - Request Examples

This document provides comprehensive examples of how to structure requests for different schedule update scenarios.

---

## 📋 **Scenario Setup**

**Existing Session:**
- Session ID: `session-123`
- Recurrence Type: `WEEKLY`
- Date Range: Jan 1 - June 30, 2025
- Current Schedules:
  - **Monday 8:00 AM** (Schedule ID: `mon-8am-id`)
  - **Monday 9:00 AM** (Schedule ID: `mon-9am-id`)
  - **Tuesday 9:00 AM** (Schedule ID: `tue-9am-id`)

---

## 🎯 **Scenario 1: Update ONE Specific Schedule (Tuesday 9am → 10am)**

### ✅ **Method 1: Using `updated_schedules` (Recommended)**

```json
{
  "session_id": "session-123",
  "start_time": "2025-01-01T00:00:00Z",
  "session_end_date": "2025-06-30",
  "recurrence_type": "WEEKLY",
  "default_meet_link": "https://zoom.us/j/123456789",
  
  "updated_schedules": [
    {
      "id": "tue-9am-id",
      "day": "TUESDAY",
      "start_time": "10:00",
      "duration": "60",
      "link": null,
      "thumbnail_file_id": null,
      "daily_attendance": false
    }
  ]
}
```

**Result:**
- ✅ Only Tuesday 9am schedules updated to 10am
- ✅ Monday 8am and Monday 9am remain unchanged
- ✅ Updates ALL future Tuesday 9am occurrences (Feb 6, 13, 20... through June)

---

### ✅ **Method 2: Using `added_schedules` with IDs (After Fix)**

```json
{
  "session_id": "session-123",
  "start_time": "2025-01-01T00:00:00Z",
  "session_end_date": "2025-06-30",
  "recurrence_type": "WEEKLY",
  "default_meet_link": "https://zoom.us/j/123456789",
  
  "added_schedules": [
    {
      "id": "mon-8am-id",
      "day": "MONDAY",
      "start_time": "08:00",
      "duration": "60"
    },
    {
      "id": "mon-9am-id",
      "day": "MONDAY",
      "start_time": "09:00",
      "duration": "60"
    },
    {
      "id": "tue-9am-id",
      "day": "TUESDAY",
      "start_time": "10:00",  // ✏️ Changed from 09:00 to 10:00
      "duration": "60"
    }
  ]
}
```

**Result:**
- ✅ Each schedule updated individually based on its ID
- ✅ Only Tuesday updates to 10am
- ✅ Monday schedules remain at 8am and 9am

**How It Works:**
- Backend detects IDs in `added_schedules`
- Routes to `updateSingleSchedule()` for each one
- No pattern-based bulk updates

---

## 🎯 **Scenario 2: Update ALL Schedules on a Day (All Tuesdays 9am → 10am)**

If you want to change ALL Tuesday schedules (not just one specific recurring series):

```json
{
  "session_id": "session-123",
  "start_time": "2025-01-01T00:00:00Z",
  "session_end_date": "2025-06-30",
  "recurrence_type": "WEEKLY",
  "default_meet_link": "https://zoom.us/j/123456789",
  
  "added_schedules": [
    {
      "day": "TUESDAY",
      "start_time": "10:00",  // No ID - triggers pattern update
      "duration": "60"
    }
  ]
}
```

**Result:**
- ✅ ALL future Tuesday schedules updated to 10am
- ✅ Useful for bulk changes

---

## 🎯 **Scenario 3: Add a New Time Slot (Add Monday 10am)**

```json
{
  "session_id": "session-123",
  "start_time": "2025-01-01T00:00:00Z",
  "session_end_date": "2025-06-30",
  "recurrence_type": "WEEKLY",
  "default_meet_link": "https://zoom.us/j/123456789",
  
  "added_schedules": [
    {
      "id": "mon-8am-id",
      "day": "MONDAY",
      "start_time": "08:00",
      "duration": "60"
    },
    {
      "id": "mon-9am-id",
      "day": "MONDAY",
      "start_time": "09:00",
      "duration": "60"
    },
    {
      "day": "MONDAY",  // No ID - creates new series
      "start_time": "10:00",
      "duration": "60",
      "thumbnail_file_id": null,
      "daily_attendance": false
    },
    {
      "id": "tue-9am-id",
      "day": "TUESDAY",
      "start_time": "09:00",
      "duration": "60"
    }
  ]
}
```

**Result:**
- ✅ Monday 8am and 9am remain unchanged
- ✅ New Monday 10am schedules created (Jan 1, 8, 15... through June 30)
- ✅ Tuesday 9am remains unchanged

---

## 🎯 **Scenario 4: Remove a Time Slot (Delete Tuesday 9am)**

```json
{
  "session_id": "session-123",
  "start_time": "2025-01-01T00:00:00Z",
  "session_end_date": "2025-06-30",
  "recurrence_type": "WEEKLY",
  "default_meet_link": "https://zoom.us/j/123456789",
  
  "added_schedules": [
    {
      "id": "mon-8am-id",
      "day": "MONDAY",
      "start_time": "08:00",
      "duration": "60"
    },
    {
      "id": "mon-9am-id",
      "day": "MONDAY",
      "start_time": "09:00",
      "duration": "60"
    }
    // ❌ Don't include tue-9am-id - it will be auto-deleted
  ]
}
```

**Result:**
- ✅ Monday 8am and 9am remain unchanged
- ✅ ALL future Tuesday 9am schedules deleted automatically (backend detects missing day pattern)
- ✅ Past Tuesday schedules preserved (attendance history)

---

## 🎯 **Scenario 5: Change Day Pattern (Tuesday → Wednesday)**

```json
{
  "session_id": "session-123",
  "start_time": "2025-01-01T00:00:00Z",
  "session_end_date": "2025-06-30",
  "recurrence_type": "WEEKLY",
  "default_meet_link": "https://zoom.us/j/123456789",
  
  "added_schedules": [
    {
      "id": "mon-8am-id",
      "day": "MONDAY",
      "start_time": "08:00",
      "duration": "60"
    },
    {
      "id": "mon-9am-id",
      "day": "MONDAY",
      "start_time": "09:00",
      "duration": "60"
    },
    {
      "day": "WEDNESDAY",  // New day, no ID
      "start_time": "09:00",
      "duration": "60"
    }
    // ❌ Tuesday not included - will be deleted
  ]
}
```

**Result:**
- ✅ Monday schedules unchanged
- ✅ Future Tuesday schedules deleted
- ✅ New Wednesday 9am schedules created (Jan 3, 10, 17... through June 30)
- ✅ Past Tuesday schedules preserved

---

## 🎯 **Scenario 6: Extend End Date**

```json
{
  "session_id": "session-123",
  "start_time": "2025-01-01T00:00:00Z",
  "session_end_date": "2025-09-30",  // ✏️ Extended from June 30 to Sept 30
  "recurrence_type": "WEEKLY",
  "default_meet_link": "https://zoom.us/j/123456789",
  
  "added_schedules": [
    {
      "id": "mon-8am-id",
      "day": "MONDAY",
      "start_time": "08:00",
      "duration": "60"
    },
    {
      "id": "mon-9am-id",
      "day": "MONDAY",
      "start_time": "09:00",
      "duration": "60"
    },
    {
      "id": "tue-9am-id",
      "day": "TUESDAY",
      "start_time": "09:00",
      "duration": "60"
    }
  ]
}
```

**Result:**
- ✅ Existing schedules (Jan-June) remain unchanged
- ✅ New Monday 8am schedules created (July-Sept)
- ✅ New Monday 9am schedules created (July-Sept)
- ✅ New Tuesday 9am schedules created (July-Sept)

---

## 🎯 **Scenario 7: Shorten End Date**

```json
{
  "session_id": "session-123",
  "start_time": "2025-01-01T00:00:00Z",
  "session_end_date": "2025-03-31",  // ✏️ Shortened from June 30 to March 31
  "recurrence_type": "WEEKLY",
  "default_meet_link": "https://zoom.us/j/123456789",
  
  "added_schedules": [
    {
      "id": "mon-8am-id",
      "day": "MONDAY",
      "start_time": "08:00",
      "duration": "60"
    },
    {
      "id": "mon-9am-id",
      "day": "MONDAY",
      "start_time": "09:00",
      "duration": "60"
    },
    {
      "id": "tue-9am-id",
      "day": "TUESDAY",
      "start_time": "09:00",
      "duration": "60"
    }
  ]
}
```

**Result:**
- ✅ Schedules Jan-March remain unchanged
- ✅ Future schedules April-June automatically deleted
- ✅ Past schedules preserved (attendance history)

---

## 🎯 **Scenario 8: Complex Update (Multiple Changes)**

Change Tuesday 9am → 10am, Add Friday 2pm, Remove Monday 8am, Extend to Sept:

```json
{
  "session_id": "session-123",
  "start_time": "2025-01-01T00:00:00Z",
  "session_end_date": "2025-09-30",  // Extended
  "recurrence_type": "WEEKLY",
  "default_meet_link": "https://zoom.us/j/123456789",
  
  "added_schedules": [
    // ❌ mon-8am-id NOT included - will be deleted
    {
      "id": "mon-9am-id",
      "day": "MONDAY",
      "start_time": "09:00",
      "duration": "60"
    },
    {
      "id": "tue-9am-id",
      "day": "TUESDAY",
      "start_time": "10:00",  // Changed from 9am
      "duration": "60"
    },
    {
      "day": "FRIDAY",  // New day
      "start_time": "14:00",
      "duration": "90",
      "thumbnail_file_id": null,
      "daily_attendance": true
    }
  ]
}
```

**Result:**
- ✅ Future Monday 8am schedules deleted
- ✅ Monday 9am unchanged, extended through Sept
- ✅ Tuesday changed to 10am, extended through Sept
- ✅ Friday 2pm created (Jan-Sept)

---

## 🎯 **Scenario 9: Update Single Date (Not Recurring)**

If you want to update ONE specific date only (e.g., only Tuesday Feb 6):

```json
{
  "session_id": "session-123",
  "start_time": "2025-01-01T00:00:00Z",
  "session_end_date": "2025-06-30",
  "recurrence_type": "WEEKLY",
  "default_meet_link": "https://zoom.us/j/123456789",
  
  "updated_schedules": [
    {
      "id": "specific-schedule-id-for-feb-6",  // ID of Feb 6 Tuesday schedule
      "day": "TUESDAY",
      "start_time": "10:00",
      "duration": "60"
    }
  ]
}
```

**Result:**
- ✅ Only Tuesday Feb 6 updated to 10am
- ✅ Other Tuesday dates (Feb 13, 20, 27...) remain at 9am
- ✅ All Monday schedules unchanged

**Note:** You need the specific schedule ID for that date (Feb 6), not the "series" ID.

---

## 🔑 **Key Rules**

### **IDs in `added_schedules`**
- **With ID**: Updates that specific schedule only
- **Without ID**: Pattern-based update (all schedules for that day) OR creates new series

### **Day Pattern Matching**
- If a day is missing from `added_schedules`, its future schedules are **deleted**
- Past schedules are always preserved (attendance history)

### **End Date Changes**
- **Extended**: New schedules auto-created
- **Shortened**: Future schedules auto-deleted

### **When to Use Each Field**

| Field | Use Case |
|-------|----------|
| `added_schedules` with IDs | Send complete current state (all schedules) |
| `added_schedules` without IDs | Add new time slots or pattern updates |
| `updated_schedules` | Update specific individual schedules |
| `deleted_schedule_ids` | Explicitly delete specific schedules |

---

## 🚀 **Best Practices**

### **For Individual Changes**
Use `updated_schedules` when changing one schedule:
```json
{
  "updated_schedules": [{ "id": "...", "start_time": "10:00", ... }]
}
```

### **For Complete State**
Send all schedules with IDs in `added_schedules`:
```json
{
  "added_schedules": [
    { "id": "...", "day": "MONDAY", ... },
    { "id": "...", "day": "TUESDAY", ... }
  ]
}
```

### **For Pattern Changes**
Send days without IDs to apply to all:
```json
{
  "added_schedules": [
    { "day": "MONDAY", "start_time": "10:00", ... }  // Updates ALL Mondays
  ]
}
```

---

## 📝 **DTO Reference**

### **ScheduleDTO Fields**
```typescript
{
  id?: string;              // Optional - if present, updates specific schedule
  day: string;              // Required - "MONDAY", "TUESDAY", etc.
  start_time: string;       // Required - "HH:mm" format (e.g., "10:00")
  duration: string;         // Required - minutes as string (e.g., "60")
  link?: string;            // Optional - custom meeting link
  thumbnail_file_id?: string; // Optional
  daily_attendance: boolean;  // Required
}
```

### **Main Request Fields**
```typescript
{
  session_id: string;           // Required for updates
  start_time: string;           // ISO timestamp
  session_end_date: string;     // ISO date "YYYY-MM-DD"
  recurrence_type: string;      // "WEEKLY", "NONE", etc.
  default_meet_link: string;
  
  added_schedules?: ScheduleDTO[];    // New or existing schedules
  updated_schedules?: ScheduleDTO[];  // Specific updates (must have ID)
  deleted_schedule_ids?: string[];    // Explicit deletions
}
```

---

## ✅ **Summary**

Your specific case (**Tuesday 9am → 10am**):

**Simplest approach:**
```json
{
  "session_id": "session-123",
  "updated_schedules": [
    { "id": "tue-9am-id", "start_time": "10:00", "duration": "60" }
  ]
}
```

**Complete state approach:**
```json
{
  "session_id": "session-123",
  "added_schedules": [
    { "id": "mon-8am-id", "day": "MONDAY", "start_time": "08:00", "duration": "60" },
    { "id": "mon-9am-id", "day": "MONDAY", "start_time": "09:00", "duration": "60" },
    { "id": "tue-9am-id", "day": "TUESDAY", "start_time": "10:00", "duration": "60" }
  ]
}
```

Both will work correctly after the fix! 🎉

