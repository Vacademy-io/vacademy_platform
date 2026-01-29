# Course Management & Edit API Guide

This document outlines the APIs available for **viewing**, **editing**, and **deleting** Courses (Packages), Batches (Sessions), Enrollment Settings, Payment Options, and Faculty Assignments.

---

## 1. Package (Course) Management

Use these APIs to manage high-level course information like the name, descriptions, media, and tags.

### 1.1 Get Course Details

Allows fetching the full details of a course to populate edit forms.

- **Endpoint:** `GET /admin-core-service/packages/v1/package-detail?packageId={packageId}`
- **Controller:** `PackageController`

### 1.2 Update Course Details

Updates the core metadata of a course.

- **Endpoint:** `PUT /admin-core-service/course/v1/update-course/{courseId}`
- **Controller:** `CourseController`

**Request Body (`PackageDTO`):**

```json
{
  "package_name": "Updated Course Name",
  "thumbnail_file_id": "file_123",
  "is_course_published_to_catalaouge": true,
  "course_preview_image_media_id": "media_123",
  "course_banner_media_id": "media_456",
  "course_media_id": "media_789",
  "why_learn_html": "<p>Updated reasoning...</p>",
  "who_should_learn_html": "<p>Target audience...</p>",
  "about_the_course_html": "<p>Course overview...</p>",
  "tags": ["java", "spring", "backend"],
  "course_depth": 5,
  "course_html_description_html": "<p>Full description...</p>"
}
```

### 1.3 Delete Courses

Marks one or multiple courses as `DELETED`. This cascades to sessions and enroll invites.

- **Endpoint:** `DELETE /admin-core-service/course/v1/delete-courses`
- **Controller:** `CourseController`

**Request Body:**

```json
["course_id_1", "course_id_2"]
```

---

## 2. Faculty Management

Manage which teachers are assigned to specific batches and subjects within the course.

### 2.1 Get Faculty Assignments

Get list of batches and subjects a faculty member is assigned to.

- **Endpoint:** `GET /admin-core-service/institute/v1/faculty/batch-subject-assignments?userId={userId}`
- **Controller:** `FacultyController`

### 2.2 Assign Faculty to Batch/Subject

- **Endpoint:** `POST /admin-core-service/institute/v1/faculty/assign-subjects-and-batches`
- **Controller:** `FacultyController`

**Request Body:**

```json
{
  "user_id": "user_123",
  "batch_ids": ["batch_1", "batch_2"],
  "subject_ids": ["sub_1"]
}
```

### 2.3 Update Faculty Assignments

- **Endpoint:** `PUT /admin-core-service/institute/v1/faculty/update-assign-subjects-and-batches`
- **Controller:** `FacultyController`

---

## 3. Batch (Session) Management

Use these APIs to manage specific class sessions/batches and their seat limits.

### 3.1 Get Batches for a Course

Retrieves all **ACTIVE** batches for a specific course.

- **Endpoint:** `GET /admin-core-service/course/v1/{courseId}/batches`
- **Controller:** `CourseController`

**Response:**

```json
[
  {
    "id": "package_session_id_1",
    "package_dto": { ... },
    "level": {
      "id": "level_id",
      "level_name": "Beginner"
    },
    "session": {
      "id": "session_id",
      "session_name": "Jan 2024",
      "start_date": "2024-01-01"
    }
  }
]
```

### 3.2 Update Inventory (Seats)

Updates the maximum capacity for a specific batch.

- **Endpoint:** `PUT /admin-core-service/package-session/{packageSessionId}/inventory/update-capacity`
- **Controller:** `PackageSessionInventoryController`

**Request Body:**

```json
{
  "max_seats": 100
}
```

### 3.3 Delete Batches

Marks one or multiple batches as `DELETED`.

- **Endpoint:** `DELETE /admin-core-service/batch/v1/delete-batches`
- **Controller:** `BatchController`

**Request Body:**

```json
["package_session_id_1", "package_session_id_2"]
```

---

## 4. Enrollment & Invite Management

Use these APIs to manage the "Enroll Invite" object, which controls dates, codes, and access rules.

### 4.1 Get Invite Details

- **By ID:** `GET /admin-core-service/v1/enroll-invite/{instituteId}/{enrollInviteId}`
- **By Session (Default):** `GET /admin-core-service/v1/enroll-invite/default/{instituteId}/{packageSessionId}`
- **Controller:** `EnrollInviteController`

### 4.2 Edit Enroll Invite Details

Updates the invite's configuration (name, dates, etc.).

- **Endpoint:** `PUT /admin-core-service/v1/enroll-invite/enroll-invite`
- **Controller:** `EnrollInviteController`

**Request Body (`EnrollInviteDTO`):**

```json
{
  "id": "enroll_invite_id", // REQUIRED
  "name": "Updated Invite Name",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "status": "ACTIVE", // or INACTIVE
  "institute_id": "inst_123",
  "invite_code": "SECRET123" // Optional override
}
```

### 4.3 Reset/Sync Default Invite Configuration

Resets an invite to the default configuration based on the package session.

- **Endpoint:** `PUT /admin-core-service/v1/enroll-invite/update-default-enroll-invite-config`
- **Query Params:**
  - `enrollInviteId`: The ID of the invite to update.
  - `packageSessionId`: The source package session ID.

### 4.4 Manage Invite Payment Options

Links or unlinks specific Payment Options to/from a Package Session within an Invite. This is how you say "Batch A supports Payment Plan X".

- **Endpoint:** `PUT /admin-core-service/v1/enroll-invite/enroll-invite-payment-option`
- **Controller:** `EnrollInviteController`

**Request Body:**

```json
[
  {
    "enroll_invite_id": "invite_id",
    "update_payment_options": [
      {
        "old_package_session_payment_option_id": "junction_id_to_remove", // Optional: if replacing/removing
        "new_package_session_payment_option": {
          "payment_option": { "id": "payment_option_id" },
          "package_session_id": "package_session_id",
          "status": "ACTIVE"
        }
      }
    ]
  }
]
```

### 4.5 Delete Enroll Invites

- **Endpoint:** `DELETE /admin-core-service/v1/enroll-invite/enroll-invites`
- **Body:** `["id1", "id2"]`

---

## 5. Payment Option Management

Use these APIs to edit the actual Pricing logic (e.g., changing a price from $500 to $600).

### 5.1 Get Payment Options

- **List (Filter):** `POST /admin-core-service/v1/payment-option/get-payment-options`
- **Get Default:** `GET /admin-core-service/v1/payment-option/default-payment-option`
- **Controller:** `PaymentOptionController`

### 5.2 Edit Payment Option

Updates the structure of a payment option (price, currency, plans).

- **Endpoint:** `PUT /admin-core-service/v1/payment-option`
- **Controller:** `PaymentOptionController`

**Request Body (`PaymentOptionDTO`):**

```json
{
  "id": "payment_option_id", // REQUIRED
  "name": "Early Bird Price",
  "status": "ACTIVE",
  "type": "ONE_TIME", // or SUBSCRIPTION, FREE
  "require_approval": false,
  "payment_plans": [
    {
      "id": "plan_id", // Include if updating existing plan
      "actual_price": 500.0,
      "elevated_price": 600.0,
      "currency": "USD",
      "validity_in_days": 365
    }
  ]
}
```

### 5.3 Delete Payment Options

- **Endpoint:** `DELETE /admin-core-service/v1/payment-option`
- **Controller:** `PaymentOptionController`

**Request Body:**

```json
["payment_option_id_1", "payment_option_id_2"]
```
