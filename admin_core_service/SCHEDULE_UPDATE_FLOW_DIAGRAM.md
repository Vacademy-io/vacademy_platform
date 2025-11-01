# Live Session Schedule Update - Flow Diagram

## 🔄 Main Decision Flow

```
┌─────────────────────────────────┐
│  POST /create/step1             │
│  (LiveSessionStep1RequestDTO)   │
└────────────┬────────────────────┘
             │
             ▼
    ┌────────────────────┐
    │ Has sessionId?     │
    └────┬──────────┬────┘
         │          │
     YES │          │ NO
         │          │
         ▼          ▼
    ┌────────┐   ┌──────────┐
    │ UPDATE │   │  CREATE  │
    │  MODE  │   │   MODE   │
    └────┬───┘   └────┬─────┘
         │            │
         │            ▼
         │       ┌──────────────────────────┐
         │       │ Use Original Simple Logic│
         │       │ - handleAddedSchedules() │
         │       │ - handleUpdatedSchedules()│
         │       │ - handleDeletedSchedules()│
         │       └──────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────┐
    │ handleScheduleUpdatesForExistingSession()│
    │ (NEW COMPREHENSIVE HANDLER)          │
    └────┬─────────────────────────────────┘
         │
         ▼
```

## 🔧 Update Mode - Detailed Flow

```
┌────────────────────────────────────────────────────────┐
│ Step 1: Handle Explicit Deletions                      │
│ ────────────────────────────────────                   │
│ • Process deletedScheduleIds from request              │
│ • Disable notifications → Delete schedules             │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Step 2: Fetch & Categorize Schedules                   │
│ ────────────────────────────────────                   │
│ • Get all existing schedules                           │
│ • Split: Past (≤ today) vs Future (> today)           │
│ • Only future schedules can be deleted                 │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Step 3: Recurrence Type Check (TODO)                   │
│ ────────────────────────────────────                   │
│ • Check if WEEKLY ↔ NONE conversion                    │
│ • If yes: Clear all & recreate (not implemented yet)   │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Step 4: Handle Date Range & Day Pattern Changes        │
│ ────────────────────────────────────────               │
│                                                         │
│ ┌─────────────────────────────────────────────┐       │
│ │ 4a. Day Pattern Changes                     │       │
│ │ ─────────────────────────                   │       │
│ │ Before: Mon/Wed  →  After: Mon/Fri          │       │
│ │ Action: Delete future Wed schedules         │       │
│ └─────────────────────────────────────────────┘       │
│                                                         │
│ ┌─────────────────────────────────────────────┐       │
│ │ 4b. End Date Shortening                     │       │
│ │ ─────────────────────────                   │       │
│ │ Before: Jan-June  →  After: Jan-March       │       │
│ │ Action: Delete future schedules > March 31  │       │
│ └─────────────────────────────────────────────┘       │
│                                                         │
│ ┌─────────────────────────────────────────────┐       │
│ │ 4c. Start Date Forward Movement             │       │
│ │ ─────────────────────────                   │       │
│ │ Before: Jan 1  →  After: Feb 1              │       │
│ │ Action: Delete future schedules < Feb 1     │       │
│ └─────────────────────────────────────────────┘       │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Step 5: Process Each Day Pattern                       │
│ ────────────────────────────────────                   │
│ FOR EACH day in addedSchedules (Mon, Wed, Fri...):     │
│                                                         │
│ ┌─────────────────────────────────────────────┐       │
│ │ 5a. Update Existing Future Schedules        │       │
│ │ ─────────────────────────────────           │       │
│ │ • Find future schedules for this day         │       │
│ │ • Update: time, duration, link, thumbnail    │       │
│ └─────────────────────────────────────────────┘       │
│                                                         │
│ ┌─────────────────────────────────────────────┐       │
│ │ 5b. Create New Schedules (End Extension)    │       │
│ │ ─────────────────────────────────           │       │
│ │ • Find last existing schedule for this day   │       │
│ │ • If last < new_end_date:                    │       │
│ │   Create schedules weekly until new_end_date │       │
│ └─────────────────────────────────────────────┘       │
│                                                         │
│ ┌─────────────────────────────────────────────┐       │
│ │ 5c. Create New Schedules (Start Extension)  │       │
│ │ ─────────────────────────────────           │       │
│ │ • Find first existing schedule for this day  │       │
│ │ • If first > new_start_date:                 │       │
│ │   Create schedules weekly to fill the gap    │       │
│ └─────────────────────────────────────────────┘       │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
           ┌──────────────┐
           │ Return Result│
           └──────────────┘
```

## 📊 Example Scenarios Visualized

### Scenario 1: Extend End Date

```
Before:
Jan 1 ─────────────────────────► March 31
  M   M   M   M   M   M   M   M   M   M   M   M   M
 1/1 1/8 1/15 1/22 1/29 2/5 2/12 2/19 2/26 3/4 3/11 3/18 3/25

After (new end date: June 30):
Jan 1 ──────────────────────────────────────────────────► June 30
  M   M   M   M   M   M   M   M   M   M   M   M   M   [NEW] [NEW] [NEW]...
 1/1 1/8 1/15 1/22 1/29 2/5 2/12 2/19 2/26 3/4 3/11 3/18 3/25  4/1  4/8  4/15

Action: Create 13 new Monday schedules (April-June)
```

### Scenario 2: Shorten End Date

```
Before:
Jan 1 ──────────────────────────────────────────────────► June 30
  M   M   M   M   M   M   M   M   M   M   M   M   M   M   M   M   M...
 1/1 1/8 1/15 1/22 1/29 2/5 2/12 2/19 2/26 3/4 3/11 3/18 3/25 4/1 4/8 4/15 4/22...

After (new end date: March 31):
Jan 1 ─────────────────────────► March 31 ❌ ❌ ❌ ❌ ❌ ❌ ❌
  M   M   M   M   M   M   M   M   M   M   M   M   M   X  X  X  X
 1/1 1/8 1/15 1/22 1/29 2/5 2/12 2/19 2/26 3/4 3/11 3/18 3/25 DEL DEL DEL

Action: Delete 13 Monday schedules (April-June)
        Only if they're in the future!
```

### Scenario 3: Change Day Pattern

```
Before (Mon/Wed):
M   W   M   W   M   W   M   W   M   W   M   W
1/1 1/3 1/8 1/10 1/15 1/17 1/22 1/24 1/29 1/31 2/5 2/7...

After (Mon/Fri):
M   ❌  M   ✅  M   ❌  M   ✅  M   ❌  M   ✅
1/1 DEL 1/8 NEW 1/15 DEL 1/22 NEW 1/29 DEL 2/5 NEW...
        1/12      1/19      1/26      2/2

Action: 
1. Delete future Wednesday schedules
2. Create Friday schedules
```

### Scenario 4: Move Start Date Forward

```
Before (Jan 1 start):
Jan 1 ──────────────────────────────────────► June 30
  M   M   M   M   M   M   M   M   M   M   M   M   M...
 1/1 1/8 1/15 1/22 1/29 2/5 2/12 2/19 2/26 3/4 3/11 3/18 3/25...

After (Feb 1 start):
❌  ❌  ❌  ❌  Feb 5 ──────────────────────────► June 30
 X   X   X   X    M   M   M   M   M   M   M   M   M...
DEL DEL DEL DEL  2/5 2/12 2/19 2/26 3/4 3/11 3/18 3/25 4/1...

Action: Delete future Mondays before Feb 1 (only future ones!)
```

### Scenario 5: Move Start Date Backward

```
Before (Feb 5 start):
                  Feb 5 ────────────────────► June 30
                   M   M   M   M   M   M   M   M   M...
                  2/5 2/12 2/19 2/26 3/4 3/11 3/18 3/25 4/1...

After (Jan 1 start):
Jan 1 ──────────────────────────────────────────────► June 30
 [NEW][NEW][NEW][NEW] M   M   M   M   M   M   M   M   M...
 1/1  1/8  1/15 1/22 1/29 2/5 2/12 2/19 2/26 3/4 3/11 3/18 3/25...

Action: Create 4 new Monday schedules (Jan 8, 15, 22, 29)
        Note: Jan 1 is not Monday, so starts from Jan 8
```

## 🔑 Key Decision Points

```
┌─────────────────────────────────────────────────────┐
│ For each existing schedule, should we DELETE it?    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ✅ DELETE if:                                       │
│     • Is in FUTURE (meeting_date > TODAY)            │
│     AND                                              │
│     (                                                │
│       • Day no longer in request                     │
│       OR                                             │
│       • Date > new end date                          │
│       OR                                             │
│       • Date < new start date                        │
│       OR                                             │
│       • Explicitly in deletedScheduleIds             │
│     )                                                │
│                                                      │
│  ❌ DON'T DELETE if:                                 │
│     • Is in PAST (meeting_date ≤ TODAY)              │
│       → Preserve for attendance history              │
│                                                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Should we CREATE new schedules?                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ✅ CREATE if:                                       │
│     • Day is in request                              │
│     AND                                              │
│     (                                                │
│       • Last schedule date < new end date            │
│         → Extend forward                             │
│       OR                                             │
│       • First schedule date > new start date         │
│         → Extend backward                            │
│       OR                                             │
│       • No schedules exist for this day              │
│         → Create from scratch                        │
│     )                                                │
│                                                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Should we UPDATE existing schedule?                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ✅ UPDATE if:                                       │
│     • Schedule exists in DB                          │
│     AND                                              │
│     • Is in FUTURE (meeting_date > TODAY)            │
│     AND                                              │
│     • Day matches request                            │
│                                                      │
│  What gets updated:                                  │
│     • start_time                                     │
│     • duration (recalculates last_entry_time)        │
│     • link (meeting URL)                             │
│     • thumbnail_file_id                              │
│     • daily_attendance flag                          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## 🎯 Summary

```
INPUT: Current state (days, times, date range)
         ↓
BACKEND: Automatically determines
         • What to delete
         • What to create  
         • What to update
         ↓
OUTPUT: Fully synchronized schedule database
```

**No frontend calculations needed!**  
**Backend is the single source of truth.**

