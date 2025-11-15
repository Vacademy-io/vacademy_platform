# Payment Log Listing API

## Endpoint

```
POST /admin-core-service/v1/user-plan/payment-logs?pageNo={page}&pageSize={size}
```

## Description

Returns a paginated list of payment logs for a given institute, enriched with user-plan information plus the derived `current_payment_status`. Filtering is handled fully in the database to keep the response performant even for large datasets.

## Request Payload

| Field                 | Type                 | Required | Description                                                                            |
| --------------------- | -------------------- | -------- | -------------------------------------------------------------------------------------- |
| `institute_id`        | `string`             | ✅       | Institute whose payment logs should be fetched.                                        |
| `start_date_in_utc`   | `string` (ISO)       | ❌       | Inclusive lower bound for `payment_log.created_at`. Defaults to `1970-01-01T00:00:00`. |
| `end_date_in_utc`     | `string` (ISO)       | ❌       | Inclusive upper bound for `payment_log.created_at`. Defaults to current timestamp.     |
| `payment_statuses`    | `string[]`           | ❌       | Filter by `payment_log.payment_status` (e.g., `["PAID","FAILED"]`).                    |
| `user_plan_statuses`  | `string[]`           | ❌       | Filter by associated `user_plan.status`.                                               |
| `enroll_invite_ids`   | `string[]`           | ❌       | Restrict to specific enroll invites.                                                   |
| `package_session_ids` | `string[]`           | ❌       | Restrict to invites that map to the provided package sessions (via PSLI table).        |
| `sort_columns`        | `map<string,string>` | ❌       | Column → direction map; defaults to `{"created_at": "DESC"}` when empty/unspecified.   |

### Sample Request

```jsonc
{
  "institute_id": "inst_123",
  "start_date_in_utc": "2024-01-01T00:00:00",
  "end_date_in_utc": "2024-02-01T00:00:00",
  "payment_statuses": ["PAID", "FAILED"],
  "user_plan_statuses": ["ACTIVE"],
  "enroll_invite_ids": ["invite_a", "invite_b"],
  "package_session_ids": ["pkg_session_a"],
  "sort_columns": {
    "created_at": "DESC"
  }
}
```

### Payload Notes

- Any list can be omitted or empty to skip that filter.
- Invalid status values result in `400 Bad Request`.
- Sorting keys must match DB columns exposed by the native query (`created_at`, `payment_amount`, etc.).

## Response (Paginated)

```jsonc
{
  "content": [
    {
      "payment_log": {
        "id": "pl_123",
        "status": "ACTIVE",
        "payment_status": "FAILED",
        "user_id": "user_1",
        "vendor": "STRIPE",
        "vendor_id": "order_123",
        "date": "2024-01-10T10:00:00Z",
        "currency": "USD",
        "payment_amount": 199.0,
        "payment_specific_data": "{...}"
      },
      "user_plan": {
        "id": "up_123",
        "user_id": "user_1",
        "payment_plan_id": "plan_1",
        "applied_coupon_discount_id": null,
        "enroll_invite_id": "invite_a",
        "payment_option_id": "option_1",
        "status": "PAYMENT_FAILED",
        "created_at": "2024-01-09T09:00:00Z",
        "updated_at": "2024-01-09T09:00:00Z"
      },
      "current_payment_status": "NOT_INITIATED"
    }
  ],
  "pageable": { ... },
  "total_pages": 5,
  "total_elements": 100,
  "last": false,
  "size": 20,
  "number": 0
}
```

### `current_payment_status`

| Scenario                                                    | Value           |
| ----------------------------------------------------------- | --------------- |
| Log status = `PAID`                                         | `PAID`          |
| Log status = `FAILED`, user plan later becomes `ACTIVE`     | `PAID`          |
| Log status = `FAILED`, no later active plan for same invite | `FAILED`        |
| Log status = `null`                                         | `NOT_INITIATED` |
| Any other status (e.g., `PAYMENT_PENDING`)                  | Original value  |

The reconciliation logic runs inside the native SQL query, so the service simply returns the projection.

## Error Responses

- `400 Bad Request` → missing `institute_id` or invalid status name.
- `500 Internal Server Error` → unexpected failures (check server logs).

## Curl Example

```bash
curl --request POST \
  'https://<base-url>/admin-core-service/v1/user-plan/payment-logs?pageNo=0&pageSize=20' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "institute_id": "inst_123",
    "payment_statuses": ["FAILED", "PAID"],
    "package_session_ids": ["pkg_session_a"],
    "sort_columns": {
      "created_at": "DESC"
    }
  }'
```
