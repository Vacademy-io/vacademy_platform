# Timezone-Aware Search API Testing Guide

## What Changed

### Before (❌ Issues):
1. When filtering by `statuses: ["LIVE"]` without dates, it would show next month's sessions (wrong!)
2. Date comparisons didn't respect session timezones
3. Hardcoded timezone fallback wasn't clear

### After (✅ Fixed):
1. When filtering by `statuses: ["LIVE"]` without dates, shows **only TODAY's sessions** (timezone-aware)
2. All date comparisons use: `CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(s.timezone, 'Asia/Kolkata')) AS date)`
3. Each session's timezone is respected; falls back to 'Asia/Kolkata' only if not set

---

## Test Scenarios

### Scenario 1: Get LIVE Sessions (Should Return Only Today's)

```bash
curl -X POST http://localhost:8072/admin-core-service/get-sessions/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "institute_id": "c5e2ea87-6fc3-44c7-8e42-f38297dff490",
    "statuses": ["LIVE"]
  }'
```

**Expected Result:**
- Returns sessions where `meeting_date = TODAY` in each session's timezone
- A session with `timezone: "America/New_York"` is evaluated against New York's current date
- A session with `timezone: "Asia/Kolkata"` is evaluated against Kolkata's current date
- Should NOT return future sessions

**What to verify:**
```javascript
response.sessions.forEach(session => {
  // All sessions should have meeting_date = today in their timezone
  console.log(`Session: ${session.title}`);
  console.log(`Timezone: ${session.timezone}`);
  console.log(`Meeting Date: ${session.meeting_date}`);
  // meeting_date should be "today" when converted to session.timezone
});
```

---

### Scenario 2: Get Upcoming Sessions (Should Be Timezone-Aware)

```bash
curl -X POST http://localhost:8072/admin-core-service/get-sessions/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "institute_id": "c5e2ea87-6fc3-44c7-8e42-f38297dff490",
    "statuses": ["LIVE", "DRAFT"]
  }'
```

OR simply omit statuses:

```bash
curl -X POST http://localhost:8072/admin-core-service/get-sessions/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "institute_id": "c5e2ea87-6fc3-44c7-8e42-f38297dff490"
  }'
```

**Expected Result:**
- Returns sessions from TODAY to 1 MONTH ahead (timezone-aware)
- Uses `ss.meeting_date >= CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(s.timezone, 'Asia/Kolkata')) AS date)`
- Each session is evaluated in its own timezone

---

### Scenario 3: Explicit Date Range (No Timezone Conversion)

```bash
curl -X POST http://localhost:8072/admin-core-service/get-sessions/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "institute_id": "c5e2ea87-6fc3-44c7-8e42-f38297dff490",
    "start_date": "2025-10-25",
    "end_date": "2025-10-25"
  }'
```

**Expected Result:**
- Returns ALL sessions (LIVE and DRAFT by default) with `meeting_date = '2025-10-25'`
- Direct date comparison, NO timezone conversion
- Useful when you know the exact date you want

---

### Scenario 4: Compare with Old /live Endpoint

**Old Endpoint:**
```bash
curl -X GET "http://localhost:8072/admin-core-service/get-sessions/live?instituteId=c5e2ea87-6fc3-44c7-8e42-f38297dff490" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**New Endpoint (Should Return Same Results):**
```bash
curl -X POST http://localhost:8072/admin-core-service/get-sessions/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "institute_id": "c5e2ea87-6fc3-44c7-8e42-f38297dff490",
    "statuses": ["LIVE"]
  }'
```

**Verification:**
Both should return the same sessions (today's LIVE sessions in their respective timezones).

---

## Understanding Timezone Logic

### Example: Session in New York

```javascript
// Session Details
{
  session_id: "abc-123",
  title: "Morning Class",
  timezone: "America/New_York",
  meeting_date: "2025-10-25",
  start_time: "09:00:00"
}
```

### Query Behavior:

**When you search for LIVE sessions without dates:**

```sql
-- The query does this:
WHERE s.status = 'LIVE'
  AND ss.meeting_date = CAST((CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AS date)
```

**What this means:**
- If current time in New York is Oct 25, 2025 → Session is returned ✅
- If current time in New York is Oct 24, 2025 → Session is NOT returned ❌
- Even if current server time is Oct 25, but New York time is Oct 24 → Session is NOT returned ❌

**The session is evaluated in ITS timezone, not server timezone!**

---

## Edge Cases to Test

### Edge Case 1: Sessions in Different Timezones

Create test sessions in multiple timezones and query for LIVE status:

```bash
# Should only return sessions where it's currently "today" in their respective timezone
curl -X POST http://localhost:8072/admin-core-service/get-sessions/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "institute_id": "YOUR_INSTITUTE_ID",
    "statuses": ["LIVE"]
  }'
```

**Expected:**
- Session A (timezone: "Asia/Kolkata"): If it's Oct 25 in Kolkata → ✅ Included
- Session B (timezone: "America/New_York"): If it's Oct 24 in New York → ❌ Not included
- Session C (timezone: null): Falls back to 'Asia/Kolkata' → Same as Session A

### Edge Case 2: Midnight Boundary

Test when it's midnight in one timezone but not in another:

- Server time: Oct 25, 00:30 IST
- Session 1 (Asia/Kolkata): meeting_date = Oct 25 → ✅ Included
- Session 2 (America/New_York): meeting_date = Oct 25, but it's still Oct 24 in NY → ❌ Not included

### Edge Case 3: Session Without Timezone

```bash
# Session with timezone = null should fall back to Asia/Kolkata
curl -X POST http://localhost:8072/admin-core-service/get-sessions/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "institute_id": "YOUR_INSTITUTE_ID",
    "statuses": ["LIVE"]
  }'
```

**Expected:**
- Sessions with `timezone = null` or empty are evaluated as if `timezone = 'Asia/Kolkata'`
- Uses `COALESCE(s.timezone, 'Asia/Kolkata')`

---

## SQL Query Examples

### What the Query Looks Like for LIVE Status (No Dates):

```sql
SELECT DISTINCT
    s.id AS sessionId,
    s.waiting_room_time AS waitingRoomTime,
    -- ... other fields ...
    s.timezone AS timezone,
    CASE
        WHEN ss.custom_meeting_link IS NOT NULL AND ss.custom_meeting_link <> '' 
        THEN ss.custom_meeting_link
        ELSE s.default_meet_link
    END AS meetingLink
FROM live_session s
JOIN session_schedules ss ON s.id = ss.session_id
WHERE s.institute_id = 'your-institute-id'
  AND ss.status != 'DELETED'
  AND s.status IN ('LIVE')
  -- Timezone-aware date comparison:
  AND ss.meeting_date = CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(s.timezone, 'Asia/Kolkata')) AS date)
ORDER BY ss.meeting_date ASC, ss.start_time ASC
```

**Key Part:**
```sql
ss.meeting_date = CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(s.timezone, 'Asia/Kolkata')) AS date)
```

This converts CURRENT_TIMESTAMP to the session's timezone, then casts to date for comparison.

---

## Verification Checklist

After deploying, verify:

- [ ] `statuses: ["LIVE"]` without dates → Returns only today's sessions
- [ ] Sessions in different timezones are evaluated correctly
- [ ] Sessions without timezone fall back to 'Asia/Kolkata'
- [ ] Explicit date ranges work without timezone conversion
- [ ] New search API returns same results as old `/live` endpoint
- [ ] Pagination works correctly with timezone-aware queries
- [ ] Performance is acceptable (check query execution time)

---

## Debugging Tips

### Check Session's Timezone:

```sql
SELECT id, title, timezone, 
       CURRENT_TIMESTAMP AT TIME ZONE COALESCE(timezone, 'Asia/Kolkata') as current_time_in_session_tz,
       CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(timezone, 'Asia/Kolkata')) AS date) as today_in_session_tz
FROM live_session
WHERE id = 'your-session-id';
```

### Compare Old vs New Endpoints:

```bash
# Old endpoint
OLD_RESULT=$(curl -s "http://localhost:8072/admin-core-service/get-sessions/live?instituteId=YOUR_ID" \
  -H "Authorization: Bearer TOKEN" | jq '.[] | .session_id' | sort)

# New endpoint
NEW_RESULT=$(curl -s -X POST http://localhost:8072/admin-core-service/get-sessions/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"institute_id":"YOUR_ID","statuses":["LIVE"]}' \
  | jq '.sessions[] | .session_id' | sort)

# Compare
diff <(echo "$OLD_RESULT") <(echo "$NEW_RESULT")
```

---

## Summary of Changes

| Aspect | Old Behavior | New Behavior |
|--------|-------------|--------------|
| LIVE status without dates | ❌ Showed next month | ✅ Shows only today (timezone-aware) |
| Date comparison | ❌ Server timezone | ✅ Session's timezone |
| Timezone fallback | ❌ Unclear | ✅ Explicit: `COALESCE(s.timezone, 'Asia/Kolkata')` |
| Explicit dates | ✅ Direct comparison | ✅ Same (no timezone conversion) |
| Default status filter | ✅ LIVE & DRAFT | ✅ Same |
| Pagination | ✅ Working | ✅ Same |

**Key Improvement:** Sessions are now evaluated in their own timezone, not server timezone! 🌍

