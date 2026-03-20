# Timeline Event System API Documentation

The Timeline Event system tracks actions and events across various entities within the platform, such as Enquiries and Applications. It supports both automatic backend logging (e.g., when a status is updated) and manual frontend logging (e.g., when a counselor adds a note).

---

## 1. Fetch Timeline Events (GET)

Use this API to render the timeline UI for an entity (like an Enquiry or Application). It returns a chronological list of events, paginated and sorted by newest first.

**Endpoint:** `GET /admin-core-service/timeline/v1/events`

### Query Parameters

| Parameter | Type    | Required | Description                                    |
| :-------- | :------ | :------- | :--------------------------------------------- |
| `type`    | String  | Yes      | The entity type (e.g., `ENQUIRY`, `APPLICANT`) |
| `typeId`  | String  | Yes      | The UUID of the entity                         |
| `page`    | Integer | No       | Page number (default: `0`)                     |
| `size`    | Integer | No       | Number of items per page (default: `20`)       |

### Example Request

```bash
curl -X GET "http://localhost:8072/admin-core-service/timeline/v1/events?type=ENQUIRY&typeId=0e9cb6aa-c78e-4b1f-938e-d2a730f875e4&page=0&size=20" \
-H "Authorization: Bearer <YOUR_TOKEN>"
```

### Example Response (`Page<TimelineEventDTO>`)

```json
{
  "content": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "type": "ENQUIRY",
      "type_id": "0e9cb6aa-c78e-4b1f-938e-d2a730f875e4",
      "action_type": "STATUS_CHANGE",
      "actor_type": "ADMIN",
      "actor_id": "0afe6d62-82fc-4062-b9e8-9a840e969817",
      "actor_name": "Priyanshu",
      "title": "Enquiry Status Updated",
      "description": "Updated: Enquiry Status -> FOLLOW_UP.",
      "metadata": {
        "new_enquiry_status": "FOLLOW_UP"
      },
      "created_at": "2024-03-05T10:00:00.000+00:00"
    }
  ],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 20
  },
  "totalElements": 1,
  "totalPages": 1
}
```

---

## 2. Create Manual Timeline Event (POST)

Use this API from the frontend when a user (Admin, Counselor, etc.) manually adds a note or logs an offline activity (like a phone call) for an Enquiry or Application.

**Endpoint:** `POST /admin-core-service/timeline/v1/event`

### Request Body (`TimelineEventRequestDTO`)

_Note: Keys must be in `snake_case`._

| Field         | Type   | Required | Description                                             |
| :------------ | :----- | :------- | :------------------------------------------------------ |
| `type`        | String | Yes      | The entity type (e.g., `ENQUIRY`, `APPLICANT`)          |
| `type_id`     | String | Yes      | The UUID of the entity                                  |
| `action_type` | String | Yes      | The action performed (e.g., `NOTE_ADDED`, `PHONE_CALL`) |
| `title`       | String | Yes      | A short summary of the event                            |
| `description` | String | No       | Detailed information about the event                    |
| `metadata`    | Object | No       | A flexible JSON object for extra key-value attributes   |

**Important:** You do **not** need to send `actor_id` or `actor_name`. These are automatically extracted from the authenticated user's JWT token by the backend.

### Example Request

```bash
curl -X POST "http://localhost:8072/admin-core-service/timeline/v1/event" \
-H "Authorization: Bearer <YOUR_TOKEN>" \
-H "Content-Type: application/json" \
-d '{
    "type": "ENQUIRY",
    "type_id": "0e9cb6aa-c78e-4b1f-938e-d2a730f875e4",
    "action_type": "NOTE_ADDED",
    "title": "Counselor Note",
    "description": "Parent wants to visit campus next week. Call back on Monday.",
    "metadata": {
      "follow_up_date": "2024-03-12",
      "call_duration_minutes": 5
    }
}'
```

### Example Response (`TimelineEventDTO`)

Returns the freshly created event.

```json
{
  "id": "456e4567-e89b-12d3-a456-426614174111",
  "type": "ENQUIRY",
  "type_id": "0e9cb6aa-c78e-4b1f-938e-d2a730f875e4",
  "action_type": "NOTE_ADDED",
  "actor_type": "ADMIN",
  "actor_id": "0afe6d62-82fc-4062-b9e8-9a840e969817",
  "actor_name": "Priyanshu",
  "title": "Counselor Note",
  "description": "Parent wants to visit campus next week. Call back on Monday.",
  "metadata": {
    "follow_up_date": "2024-03-12",
    "call_duration_minutes": 5
  },
  "created_at": "2024-03-05T10:15:00.000+00:00"
}
```

---

## 3. Internal Usage (For Backend Developers)

If you are developing a new backend feature and need to automatically log an event when an action happens (e.g., a payment succeeds, a student is enrolled), you can inject the `TimelineEventService` directly into your Spring Service.

### Code Example

```java
import vacademy.io.admin_core_service.features.timeline.service.TimelineEventService;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class PaymentService {

    @Autowired
    private TimelineEventService timelineEventService;

    public void processPayment(String applicantId, CustomUserDetails user) {
        // ... payment logic ...

        // Log the event internally
        timelineEventService.logEvent(
            "APPLICANT",                       // type
            applicantId,                       // typeId
            "PAYMENT_SUCCESS",                 // actionType
            (user != null) ? "USER" : "SYSTEM",// actorType
            (user != null) ? user.getUserId() : null, // actorId
            (user != null) ? user.getUsername() : "SYSTEM", // actorName
            "Payment Completed",               // title
            "Applicant successfully paid application fee.", // description
            Map.of("amount", 500, "transaction_id", "txn_12345") // metadata
        );
    }
}
```

### Existing Automatic Integrations

The timeline event service is already integrated into the following backend flows:

- **Enquiry Status Bulk Update**: Generates `STATUS_CHANGE` events for Enquiries.
- **Counselor Linkage**: Generates `COUNSELOR_ASSIGNED` events for Enquiries.
- **Application Submission**: Generates `APPLICATION_SUBMITTED` or `APPLICATION_TRANSITIONED` events for Applicants.
