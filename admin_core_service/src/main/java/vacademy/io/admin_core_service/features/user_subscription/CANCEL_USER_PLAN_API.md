# Cancel User Plan API

## Overview
This API allows for the cancellation of a user's plan. It supports two modes: standard cancellation and force cancellation.

## Endpoint
`PUT /admin-core-service/v1/user-plan/{userPlanId}/cancel`

## Request Parameters

### Path Variables
| Name | Type | Description |
| :--- | :--- | :--- |
| `userPlanId` | `String` | The unique identifier of the User Plan to be canceled. |

### Query Parameters
| Name | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `force` | `boolean` | No | `false` | If `true`, performs a force cancellation (terminates plan, removes active session, restores invited state). If `false`, marks plan as `CANCELED`. |

## Responses

### Success Response
- **Status Code**: `200 OK`
- **Body**: Empty

### Error Responses
- **Status Code**: `400 Bad Request`
    - If `userPlanId` is invalid or missing.
- **Status Code**: `401 Unauthorized`
    - If the user is not authenticated.
- **Status Code**: `500 Internal Server Error`
    - If an unexpected error occurs during processing.

## Usage Examples

### 1. Standard Cancellation
Marks the user plan as `CANCELED`.

```bash
curl -X PUT "http://localhost:8080/admin-core-service/v1/user-plan/{userPlanId}/cancel" \
     -H "Authorization: Bearer <token>"
```

### 2. Force Cancellation
Marks the user plan as `TERMINATED`, deletes the active session mapping, and creates a new "Invited" mapping.

```bash
curl -X PUT "http://localhost:8080/admin-core-service/v1/user-plan/{userPlanId}/cancel?force=true" \
     -H "Authorization: Bearer <token>"
```
