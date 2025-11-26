# Sub-Organization Learner Management API

This document provides details about the Sub-Organization Learner Management APIs that allow institutes to manage course enrollments for their sub-organizations.

## Base URL
```
http://localhost:8080/admin-core-service/sub-org/v1
```

## Authentication
All endpoints require authentication. Include the user authentication token in the request headers or attributes as configured in your security setup.

---

## API Endpoints

### 1. Get Members by Package Session and Sub-Organization

Retrieve all enrolled learners for a specific package session within a sub-organization.

**Endpoint:** `GET /members`

**Query Parameters:**
- `package_session_id` (required): The ID of the package session
- `sub_org_id` (required): The ID of the sub-organization (institute)

**Response:** Returns a list of student mappings with complete user details.

**cURL Example:**
```bash
curl -X GET "http://localhost:8080/admin-core-service/sub-org/v1/members?package_session_id=session-123&sub_org_id=sub-org-456" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Success Response Example:**
```json
{
  "student_mappings": [
    {
      "id": "mapping-001",
      "user_id": "user-123",
      "institute_enrollment_number": "ENR001",
      "enrolled_date": "2025-01-15T10:30:00",
      "expiry_date": "2026-01-15T10:30:00",
      "status": "ACTIVE",
      "package_session_id": "session-123",
      "institute_id": "institute-789",
      "group_id": "group-456",
      "sub_org_id": "sub-org-456",
      "user_plan_id": null,
      "destination_package_session_id": null,
      "user": {
        "user_id": "user-123",
        "full_name": "John Doe",
        "email": "john.doe@example.com",
        "mobile_number": "+1234567890",
        "username": "johndoe"
      }
    }
  ]
}
```

---

### 2. Add Member (Enroll Learner)

Enroll a new learner into a sub-organization's package session. This endpoint creates a direct enrollment without payment tracking.

**Endpoint:** `POST /add-member`

**Request Body:**
```json
{
  "user": {
    "email": "learner@example.com",
    "mobile_number": "+1234567890",
    "full_name": "Jane Smith",
    "username": "janesmith"
  },
  "package_session_id": "session-123",
  "sub_org_id": "sub-org-456",
  "institute_id": "institute-789",
  "group_id": "group-456",
  "enrolled_date": "2025-01-20T09:00:00",
  "expiry_date": "2026-01-20T09:00:00",
  "institute_enrollment_number": "ENR002",
  "status": "ACTIVE",
  "comma_separated_org_roles": "LEARNER,STUDENT",
  "custom_field_values": [
    {
      "custom_field_id": "field-001",
      "value": "Department A"
    }
  ]
}
```

**Request Fields:**
- `user` (required): User details object
  - `email` (required): User's email address
  - `mobile_number` (optional): User's phone number
  - `full_name` (required): User's full name
  - `username` (optional): Username
- `package_session_id` (required): ID of the package session
- `sub_org_id` (required): ID of the sub-organization
- `institute_id` (required): ID of the institute
- `group_id` (optional): ID of the group
- `enrolled_date` (optional): Date of enrollment (ISO 8601 format)
- `expiry_date` (optional): Enrollment expiry date
- `institute_enrollment_number` (optional): Custom enrollment number
- `status` (optional): Enrollment status (default: ACTIVE)
- `comma_separated_org_roles` (optional): Comma-separated list of roles
- `custom_field_values` (optional): Array of custom field values

**cURL Example:**
```bash
curl -X POST "http://localhost:8080/admin-core-service/sub-org/v1/add-member" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "user": {
      "email": "learner@example.com",
      "mobile_number": "+1234567890",
      "full_name": "Jane Smith",
      "username": "janesmith"
    },
    "package_session_id": "session-123",
    "sub_org_id": "sub-org-456",
    "institute_id": "institute-789",
    "group_id": "group-456",
    "enrolled_date": "2025-01-20T09:00:00",
    "expiry_date": "2026-01-20T09:00:00",
    "institute_enrollment_number": "ENR002",
    "status": "ACTIVE",
    "comma_separated_org_roles": "LEARNER,STUDENT"
  }'
```

**Success Response Example:**
```json
{
  "user": {
    "user_id": "user-456",
    "full_name": "Jane Smith",
    "email": "learner@example.com",
    "mobile_number": "+1234567890",
    "username": "janesmith"
  },
  "mapping_id": "mapping-002",
  "message": "Learner enrolled successfully to sub-organization"
}
```

---

### 3. Terminate Member (Bulk Termination)

Terminate multiple learners from a sub-organization's package session by setting their status to TERMINATED.

**Endpoint:** `POST /terminate-member`

**Request Body:**
```json
{
  "sub_org_id": "sub-org-456",
  "institute_id": "institute-789",
  "package_session_id": "session-123",
  "user_ids": [
    "user-123",
    "user-456",
    "user-789"
  ]
}
```

**Request Fields:**
- `sub_org_id` (required): ID of the sub-organization
- `institute_id` (required): ID of the institute
- `package_session_id` (required): ID of the package session
- `user_ids` (required): Array of user IDs to terminate

**cURL Example:**
```bash
curl -X POST "http://localhost:8080/admin-core-service/sub-org/v1/terminate-member" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "sub_org_id": "sub-org-456",
    "institute_id": "institute-789",
    "package_session_id": "session-123",
    "user_ids": [
      "user-123",
      "user-456",
      "user-789"
    ]
  }'
```

**Success Response Example:**
```json
{
  "terminated_count": 3,
  "message": "Successfully terminated 3 learner(s)"
}
```

---

## Error Responses

All endpoints may return the following error responses:

**400 Bad Request:**
```json
{
  "error": "Validation error message"
}
```

**404 Not Found:**
```json
{
  "error": "Sub-organization not found with id: sub-org-456"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error occurred"
}
```

---

## Notes

1. **No Payment Tracking**: Sub-organization enrollments do not create payment records (UserPlan, PaymentLog) as these are institutional purchases.

2. **Status Values**: Valid status values for enrollments are:
   - `ACTIVE` - Active enrollment
   - `TERMINATED` - Terminated enrollment
   - `INVITED` - Pending invitation
   - `PENDING_FOR_APPROVAL` - Awaiting approval
   - `INACTIVE` - Inactive enrollment

3. **Bulk Operations**: The terminate endpoint is optimized for bulk operations and will only update records that are not already terminated.

4. **Validation**: All endpoints validate the existence of sub_org_id, institute_id, and package_session_id before processing.

5. **Custom Fields**: The enrollment endpoint supports custom field values for additional metadata per organization's requirements.

---

## Testing Tips

1. **Get Members**: Use this endpoint to verify enrollments after adding members.
2. **Add Member**: Ensure the package session is in ACTIVE status before enrolling learners.
3. **Terminate Member**: The response indicates how many records were actually updated (excludes already terminated members).
4. **Authentication**: Replace `YOUR_AUTH_TOKEN` with a valid JWT token or configure authentication as per your setup.
