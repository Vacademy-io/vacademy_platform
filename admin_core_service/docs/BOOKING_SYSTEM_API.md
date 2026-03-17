# Booking System API Documentation

> **Base URL**: `/admin-core-service/booking/v1`

This document describes the Booking System APIs for managing calendar bookings, meetings, and appointments.

---

## Table of Contents

1. [Overview](#overview)
2. [Data Models](#data-models)
3. [API Endpoints](#api-endpoints)
   - [Create Booking](#1-create-booking)
   - [Link Users to Booking](#2-link-users-to-booking)
   - [Check Availability](#3-check-availability)
   - [Cancel Booking](#4-cancel-booking)
   - [Reschedule Booking](#5-reschedule-booking)
   - [Get User Calendar](#6-get-user-calendar)
   - [Get Booking by ID](#7-get-booking-by-id)
   - [Update Booking Status](#8-update-booking-status)
   - [Booking Types CRUD](#9-booking-types-crud)
4. [Use Case Flows](#use-case-flows)
5. [Backward Compatibility](#backward-compatibility)

---

## Overview

The Booking System extends the existing Live Session infrastructure to support:

- **Calendar Bookings**: Schedule meetings for specific booking types (e.g., School Visit, Enquiry Meeting)
- **Resource Booking**: Use `source` and `source_id` to link bookings to external entities (e.g., Room, Enquiry)
- **User Management**: Add/remove participants at creation or later
- **Calendar View**: Fetch all bookings for a user in a date range

### Key Concepts

| Concept          | Description                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| **Booking Type** | Category of booking (e.g., `SCHOOL_VISIT`, `PARENT_MEETING`). Can be global or institute-specific. |
| **Source**       | External entity type linked to the booking (e.g., `ENQUIRY`, `ROOM`, `LEAD`)                       |
| **Source ID**    | ID of the external entity                                                                          |
| **Session**      | The booking record (uses `live_session` table)                                                     |
| **Schedule**     | The specific date/time slot for the booking                                                        |

### Timezone Handling

> ⚠️ **Important**: Understanding timezone handling is critical for correct booking behavior.

#### Summary

| API                    | Field                            | Type      | Format       | Timezone Expectation                                        |
| ---------------------- | -------------------------------- | --------- | ------------ | ----------------------------------------------------------- |
| **Create Booking**     | `start_time`, `last_entry_time`  | Timestamp | ISO 8601     | **UTC with offset** (e.g., `2024-05-20T10:00:00.000+05:30`) |
| **Create Booking**     | `time_zone`                      | String    | IANA         | Session's display timezone (e.g., `Asia/Kolkata`)           |
| **Check Availability** | `start_date`, `end_date`         | LocalDate | `YYYY-MM-DD` | **Date only** (no timezone)                                 |
| **Check Availability** | `start_time`, `end_time`         | LocalTime | `HH:mm:ss`   | **Session's timezone** (default: `Asia/Kolkata`)            |
| **Reschedule**         | `new_date`                       | LocalDate | `YYYY-MM-DD` | **Date only** - assumed session's timezone                  |
| **Reschedule**         | `new_start_time`, `new_end_time` | LocalTime | `HH:mm:ss`   | **Session's timezone**                                      |
| **Calendar Response**  | `start_time`, `end_time`         | LocalTime | `HH:mm:ss`   | Returned in **session's timezone**                          |

#### Rules

1. **Create Booking**:
   - Use `Timestamp` with full timezone offset (UTC-based)
   - Example: `"start_time": "2024-05-20T10:00:00.000+05:30"`
   - The `time_zone` field stores the display timezone (e.g., `Asia/Kolkata`)

2. **Check Availability & Reschedule**:
   - Use `LocalDate` (e.g., `"2024-05-20"`) and `LocalTime` (e.g., `"10:00:00"`)
   - These are **timezone-agnostic** types
   - The system assumes times are in the **session's timezone**
   - If no session timezone exists, defaults to `Asia/Kolkata`

3. **Calendar & Responses**:
   - All times returned are in the **session's stored timezone**
   - The `timezone` field is included in responses so frontend can convert if needed

4. **Database Behavior**:
   - Queries use: `COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata')`
   - This means empty/null timezone defaults to `Asia/Kolkata`

#### Frontend Guidelines

```typescript
// When creating a booking
const createBookingPayload = {
  // For Timestamps - include timezone offset
  start_time: "2024-05-20T10:00:00.000+05:30",
  last_entry_time: "2024-05-20T11:00:00.000+05:30",

  // Store the session's timezone
  time_zone: "Asia/Kolkata",

  // ... other fields
};

// For availability check - times without timezone
const checkAvailabilityPayload = {
  start_date: "2024-05-20", // Date only
  end_date: "2024-05-20",
  start_time: "10:00:00", // Time in session's timezone
  end_time: "11:00:00",
  // ... other fields
};

// For reschedule - times without timezone
const reschedulePayload = {
  schedule_id: "SCHED_123",
  new_date: "2024-05-25", // Date only
  new_start_time: "14:00:00", // Time in session's timezone
  new_end_time: "15:00:00",
};
```

---

## Data Models

### BookingType

```typescript
interface BookingType {
  id: string;
  type: string; // Display name: "School Visit"
  code: string; // Unique code: "SCHOOL_VISIT"
  description?: string;
  institute_id?: string; // null = global, otherwise institute-specific
  created_at: string;
  updated_at: string;
}
```

### CalendarEventDTO

```typescript
interface CalendarEvent {
  session_id: string;
  schedule_id: string;
  title: string;
  subject?: string;
  date: string; // "2024-05-20"
  start_time: string; // "10:00:00"
  end_time: string; // "11:00:00"
  status: string; // "LIVE", "DRAFT", "CANCELLED", "COMPLETED"
  booking_type_id?: string;
  booking_type_name?: string;
  source?: string;
  source_id?: string;
  meeting_link?: string;
  access_level: string;
  timezone: string;
}
```

### BookingDetailDTO

```typescript
interface BookingDetail {
  session_id: string;
  title: string;
  subject?: string;
  description_html?: string;
  status: string;
  access_level: string;
  timezone: string;

  // Booking Type
  booking_type_id?: string;
  booking_type_name?: string;
  booking_type_code?: string;

  // Source (linked entity)
  source?: string;
  source_id?: string;

  // Schedule
  schedule_id?: string;
  meeting_date?: string;
  start_time?: string;
  end_time?: string;
  meeting_link?: string;

  // Participants
  participants: ParticipantInfo[];

  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

interface ParticipantInfo {
  id: string;
  source_type: "USER" | "BATCH";
  source_id: string;
  name?: string;
  email?: string;
}
```

---

## API Endpoints

### 1. Create Booking

Create a new booking with optional participants.

**Endpoint**: `POST /create`

**Request Body**:

```json
{
  "institute_id": "INST_123",
  "title": "School Visit - St. Xavier's",
  "subject": "Campus Tour",
  "description_html": "<p>Initial campus tour for prospective parents</p>",

  "start_time": "2024-05-20T10:00:00.000+00:00",
  "last_entry_time": "2024-05-20T11:00:00.000+00:00",
  "session_end_date": "2024-05-20",

  "booking_type_id": "bt_abc123",
  "booking_type": "SCHOOL_VISIT",

  "source": "ENQUIRY",
  "source_id": "ENQ_98765",

  "participant_user_ids": ["USER_1", "USER_2"],

  "default_meet_link": "https://meet.google.com/abc-defg-hij",
  "time_zone": "Asia/Kolkata",
  "recurrence_type": "NONE"
}
```

**Notes**:

- `participant_user_ids` is **optional**. You can create a booking without users and link them later.
- Either `booking_type_id` OR `booking_type` (code) can be provided. If code is provided, the system resolves the ID.
- `source` and `source_id` are for linking to external entities like Enquiries, Rooms, etc.

**Response**: `LiveSession` object with the created session details.

---

### 2. Link Users to Booking

Add or remove users from an existing booking.

**Endpoint**: `POST /link-users`

**Request Body**:

```json
{
  "session_id": "SESSION_123",
  "user_ids": ["USER_3", "USER_4"],
  "remove_user_ids": ["USER_1"]
}
```

**Response**:

```json
"Successfully linked 2 users and unlinked 1 users"
```

---

### 3. Check Availability

Check if users or resources are available for a time slot.

**Endpoint**: `POST /check-availability`

**Request Body**:

```json
{
  "institute_id": "INST_123",
  "user_ids": ["USER_1", "USER_2"],
  "source": "ROOM",
  "source_id": "ROOM_A",
  "start_date": "2024-05-20",
  "end_date": "2024-05-20",
  "start_time": "10:00:00",
  "end_time": "11:00:00",
  "exclude_session_id": "SESSION_TO_IGNORE"
}
```

**Response**:

```json
{
  "available": false,
  "conflicts": [
    {
      "session_id": "SESSION_456",
      "schedule_id": "SCHED_789",
      "title": "Existing Meeting",
      "date": "2024-05-20",
      "start_time": "09:30:00",
      "end_time": "10:30:00",
      "conflicting_user_id": "USER_1"
    }
  ],
  "available_slots": []
}
```

---

### 4. Cancel Booking

Cancel a booking or specific schedule.

**Endpoint**: `POST /cancel`

**Request Body**:

```json
{
  "session_id": "SESSION_123",
  "schedule_id": null,
  "reason": "Client requested cancellation",
  "notify_participants": true
}
```

**Notes**:

- If `schedule_id` is provided, only that schedule is cancelled.
- If only `session_id` is provided, the entire session and all schedules are cancelled.

**Response**:

```json
"Session cancelled successfully"
```

---

### 5. Reschedule Booking

Change the date/time of a booking.

**Endpoint**: `POST /reschedule`

**Request Body**:

```json
{
  "schedule_id": "SCHED_123",
  "new_date": "2024-05-25",
  "new_start_time": "14:00:00",
  "new_end_time": "15:00:00",
  "reason": "Rescheduled per client request",
  "notify_participants": true
}
```

**Response**:

```json
"Booking rescheduled successfully"
```

---

### 6. Get User Calendar

Fetch all bookings for a user within a date range (optimized for calendar UI).

**Endpoint**: `GET /calendar`

**Query Parameters**:

| Parameter   | Type   | Required | Description                   |
| ----------- | ------ | -------- | ----------------------------- |
| `userId`    | string | Yes      | User ID to fetch calendar for |
| `startDate` | string | Yes      | Start date (YYYY-MM-DD)       |
| `endDate`   | string | Yes      | End date (YYYY-MM-DD)         |

**Example**: `GET /calendar?userId=USER_123&startDate=2024-05-01&endDate=2024-05-31`

**Response**:

```json
[
  {
    "session_id": "SESSION_1",
    "schedule_id": "SCHED_1",
    "title": "School Visit",
    "subject": "Campus Tour",
    "date": "2024-05-10",
    "start_time": "10:00:00",
    "end_time": "11:00:00",
    "status": "LIVE",
    "booking_type_id": "bt_123",
    "booking_type_name": "School Visit",
    "source": "ENQUIRY",
    "source_id": "ENQ_456",
    "meeting_link": "https://meet.google.com/...",
    "access_level": "PRIVATE",
    "timezone": "Asia/Kolkata"
  }
]
```

---

### 7. Get Booking by ID

Get full details of a specific booking.

**Endpoint**: `GET /{sessionId}`

**Example**: `GET /SESSION_123`

**Response**: `BookingDetailDTO` (see Data Models)

---

### 8. Update Booking Status

Update the status of a booking.

**Endpoint**: `PATCH /{sessionId}/status`

**Request Body**:

```json
{
  "status": "COMPLETED",
  "notes": "Meeting completed successfully"
}
```

**Valid Statuses**:

- `DRAFT` - Not yet published
- `LIVE` - Active/Published
- `CANCELLED` - Cancelled
- `COMPLETED` - Successfully completed
- `NO_SHOW` - Participant(s) did not attend

**Response**:

```json
"Status updated to COMPLETED"
```

---

### 9. Booking Types CRUD

#### Create Booking Type

**Endpoint**: `POST /types/create`

```json
{
  "type": "School Visit",
  "code": "SCHOOL_VISIT",
  "description": "Campus tour for prospective students",
  "institute_id": "INST_123"
}
```

**Notes**: Set `institute_id` to `null` for global types.

#### Update Booking Type

**Endpoint**: `PUT /types/{id}`

```json
{
  "type": "School Campus Visit",
  "description": "Updated description"
}
```

#### Delete Booking Type

**Endpoint**: `DELETE /types/{id}`

#### List Booking Types (for an Institute)

**Endpoint**: `GET /types/list?instituteId=INST_123&page=0&size=20`

**Returns**: Paginated list of booking types (global + institute-specific)

#### Get All Booking Types (Admin)

**Endpoint**: `GET /types/all?page=0&size=20`

**Returns**: All booking types in the system (for super admin)

#### Get Global Booking Types Only

**Endpoint**: `GET /types/global?page=0&size=20`

**Returns**: Only global booking types (where `institute_id` is null)

#### Get Institute-Specific Booking Types Only

**Endpoint**: `GET /types/by-institute?instituteId=INST_123&page=0&size=20`

**Returns**: Only booking types created by the specified institute

---

## Use Case Flows

### Flow 1: Book a Meeting for a Booking Type (No Users)

```
1. GET /types/list?instituteId=... → Get available booking types
2. POST /create → Create booking with booking_type_id, NO participant_user_ids
3. (Later) POST /link-users → Add users when ready
```

### Flow 2: Book a Meeting with Users

```
1. POST /check-availability → Ensure users are free
2. POST /create → Create booking with participant_user_ids
```

### Flow 3: Book a Room (Resource)

```
1. POST /check-availability → Check room availability
   {
     "source": "ROOM",
     "source_id": "CONF_ROOM_A",
     "start_date": "2024-05-20",
     "end_date": "2024-05-20",
     "start_time": "10:00:00",
     "end_time": "11:00:00"
   }
2. POST /create → Create booking with source/source_id
```

### Flow 4: View User Calendar

```
GET /calendar?userId=USER_123&startDate=2024-05-01&endDate=2024-05-31
→ Returns all bookings for calendar display
```

### Flow 5: Search Bookings (Advanced)

Use the existing search API:

```
POST /admin-core-service/get-sessions/search
{
  "institute_id": "INST_123",
  "booking_type_ids": ["bt_123"],
  "source": "ENQUIRY",
  "source_id": "ENQ_456",
  "time_status": "UPCOMING",
  "page": 0,
  "size": 20
}
```

---

## Backward Compatibility

### ✅ Existing APIs Unaffected

All existing Live Session APIs continue to work:

| Existing Endpoint                                        | Status                               |
| -------------------------------------------------------- | ------------------------------------ |
| `GET /admin-core-service/get-sessions/live`              | ✅ Works                             |
| `GET /admin-core-service/get-sessions/upcoming`          | ✅ Works                             |
| `GET /admin-core-service/get-sessions/past`              | ✅ Works                             |
| `GET /admin-core-service/get-sessions/draft`             | ✅ Works                             |
| `POST /admin-core-service/live-sessions/v1/create/step1` | ✅ Works                             |
| `POST /admin-core-service/live-sessions/v1/create/step2` | ✅ Works                             |
| `POST /admin-core-service/get-sessions/search`           | ✅ Works (enhanced with new filters) |

### New Optional Fields

The following fields are **optional** and default to `null`:

- `booking_type_id`
- `source`
- `source_id`

Existing sessions without these fields will continue to work exactly as before.

---

## Error Responses

All APIs return standard error format:

```json
{
  "status": 404,
  "message": "Session not found",
  "timestamp": "2024-05-20T10:00:00.000Z"
}
```

Common error codes:

- `400` - Bad Request (missing required fields)
- `404` - Not Found (session/schedule/booking type not found)
- `409` - Conflict (for availability checks)

---

## TypeScript Types (Frontend Reference)

```typescript
// Request types
interface CreateBookingRequest {
  institute_id: string;
  title: string;
  subject?: string;
  description_html?: string;
  start_time: string;
  last_entry_time: string;
  session_end_date: string;
  booking_type_id?: string;
  booking_type?: string;
  source?: string;
  source_id?: string;
  participant_user_ids?: string[];
  default_meet_link?: string;
  time_zone?: string;
  recurrence_type?: string;
}

interface LinkUsersRequest {
  session_id: string;
  user_ids?: string[];
  remove_user_ids?: string[];
}

interface CheckAvailabilityRequest {
  institute_id: string;
  user_ids?: string[];
  source?: string;
  source_id?: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  exclude_session_id?: string;
}

interface CancelBookingRequest {
  session_id?: string;
  schedule_id?: string;
  reason?: string;
  notify_participants?: boolean;
}

interface RescheduleRequest {
  schedule_id: string;
  new_date: string;
  new_start_time: string;
  new_end_time: string;
  reason?: string;
  notify_participants?: boolean;
}

interface UpdateStatusRequest {
  status: "DRAFT" | "LIVE" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  notes?: string;
}
```
