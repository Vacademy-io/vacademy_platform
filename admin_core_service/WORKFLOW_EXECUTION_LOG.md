# Workflow Execution Logs API Documentation

## Overview
This API provides endpoints to retrieve detailed execution logs for workflow runs. Each log entry contains information about individual node executions, including success/failure status, timing, and detailed results.

---

## Base URL
```
/admin-core-service/workflow/logs
```

---

## Caching

The API implements intelligent caching using Caffeine for improved performance:

- **Cache Duration**: 5 minutes
- **Max Entries**: 1000 per cache
- **Cache Invalidation**: Automatic when execution logs are updated
- **Cached Endpoints**:
    - `GET /execution/{executionId}` - Cached by execution ID
    - `GET /execution/{executionId}/node/{nodeId}` - Cached by execution ID + node ID

**Benefits:**
- Reduced database load for frequently accessed logs
- Faster response times for completed executions
- Automatic cache eviction when logs are updated

**Note:** Running executions (status = `RUNNING`) should be polled with caution as cache may return stale data for up to 5 minutes. For real-time updates, consider using shorter polling intervals or WebSockets.

---

## Authentication
All endpoints require authentication. Include your authentication token in the request headers:
```bash
Authorization: Bearer <your-token>
```

---

## Endpoints

### 1. Get All Logs for a Workflow Execution

Retrieves all node execution logs for a specific workflow execution, ordered chronologically.

**Endpoint:** `GET /execution/{executionId}`

**Parameters:**
- `executionId` (path) - The workflow execution ID

**cURL Example:**
```bash
curl -X GET "http://localhost:8080/admin-core-service/workflow/logs/execution/abc123-def456-ghi789" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:** `200 OK`
```json
[
  {
    "id": "log-uuid-1",
    "workflow_execution_id": "abc123-def456-ghi789",
    "node_template_id": "node-001",
    "node_type": "QUERY",
    "status": "SUCCESS",
    "started_at": "2025-12-10T10:00:00Z",
    "completed_at": "2025-12-10T10:00:02Z",
    "execution_time_ms": 2000,
    "error_message": null,
    "error_type": null,
    "created_at": "2025-12-10T10:00:00Z",
    "updated_at": "2025-12-10T10:00:02Z",
    "details": {
      "query": "fetch_students_by_package",
      "rowsReturned": 25,
      "executionTimeMs": 2000
    }
  },
  {
    "id": "log-uuid-2",
    "workflow_execution_id": "abc123-def456-ghi789",
    "node_template_id": "node-002",
    "node_type": "SEND_WHATSAPP",
    "status": "PARTIAL_SUCCESS",
    "started_at": "2025-12-10T10:00:02Z",
    "completed_at": "2025-12-10T10:00:07Z",
    "execution_time_ms": 5000,
    "error_message": null,
    "error_type": null,
    "created_at": "2025-12-10T10:00:02Z",
    "updated_at": "2025-12-10T10:00:07Z",
    "details": {
      "successCount": 23,
      "failureCount": 1,
      "skippedCount": 1,
      "executionTimeMs": 5000,
      "failedMessages": [
        {
          "index": 5,
          "mobileNumber": "null",
          "templateName": "welcome_msg",
          "errorMessage": "Invalid mobile number",
          "errorType": "VALIDATION_ERROR",
          "failureReason": "SKIPPED",
          "itemData": {
            "userId": "user-123",
            "name": "John Doe",
            "email": "john@example.com"
          }
        }
      ]
    }
  }
]
```

---

### 2. Get Logs for a Specific Node

Retrieves execution logs for a specific node within a workflow execution.

**Endpoint:** `GET /execution/{executionId}/node/{nodeId}`

**Parameters:**
- `executionId` (path) - The workflow execution ID
- `nodeId` (path) - The node template ID

**cURL Example:**
```bash
curl -X GET "http://localhost:8080/admin-core-service/workflow/logs/execution/abc123-def456-ghi789/node/node-002" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:** `200 OK`
```json
[
  {
    "id": "log-uuid-2",
    "workflow_execution_id": "abc123-def456-ghi789",
    "node_template_id": "node-002",
    "node_type": "SEND_WHATSAPP",
    "status": "PARTIAL_SUCCESS",
    "started_at": "2025-12-10T10:00:02Z",
    "completed_at": "2025-12-10T10:00:07Z",
    "execution_time_ms": 5000,
    "error_message": null,
    "error_type": null,
    "created_at": "2025-12-10T10:00:02Z",
    "updated_at": "2025-12-10T10:00:07Z",
    "details": {
      "successCount": 23,
      "failureCount": 1,
      "skippedCount": 1,
      "executionTimeMs": 5000,
      "failedMessages": [...]
    }
  }
]
```

---

### 3. Get Logs by Time Range

Retrieves execution logs within a specified time range with pagination.

**Endpoint:** `GET /time-range`

**Parameters:**
- `startTime` (query, required) - ISO-8601 timestamp
- `endTime` (query, required) - ISO-8601 timestamp
- `page` (query, optional) - Page number (default: 0)
- `size` (query, optional) - Page size (default: 20)

**cURL Example:**
```bash
curl -X GET "http://localhost:8080/admin-core-service/workflow/logs/time-range?startTime=2025-12-10T00:00:00Z&endTime=2025-12-10T23:59:59Z&page=0&size=20" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:** `200 OK`
```json
{
  "content": [
    {
      "id": "log-uuid-1",
      "workflow_execution_id": "abc123-def456-ghi789",
      "node_template_id": "node-001",
      "node_type": "QUERY",
      "status": "SUCCESS",
      "started_at": "2025-12-10T10:00:00Z",
      "completed_at": "2025-12-10T10:00:02Z",
      "execution_time_ms": 2000,
      "details": {...}
    }
  ],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 20,
    "sort": {
      "sorted": true,
      "unsorted": false,
      "empty": false
    },
    "offset": 0,
    "paged": true,
    "unpaged": false
  },
  "totalPages": 5,
  "totalElements": 100,
  "last": false,
  "size": 20,
  "number": 0,
  "sort": {
    "sorted": true,
    "unsorted": false,
    "empty": false
  },
  "numberOfElements": 20,
  "first": true,
  "empty": false
}
```

---

### 4. Get Logs by Node Template

Retrieves all execution logs for a specific node template across all executions.

**Endpoint:** `GET /node-template/{nodeTemplateId}`

**Parameters:**
- `nodeTemplateId` (path) - The node template ID

**cURL Example:**
```bash
curl -X GET "http://localhost:8080/admin-core-service/workflow/logs/node-template/node-002" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:** `200 OK`
```json
[
  {
    "id": "log-uuid-2",
    "workflow_execution_id": "abc123-def456-ghi789",
    "node_template_id": "node-002",
    "node_type": "SEND_WHATSAPP",
    "status": "PARTIAL_SUCCESS",
    "details": {...}
  },
  {
    "id": "log-uuid-5",
    "workflow_execution_id": "xyz789-abc123-def456",
    "node_template_id": "node-002",
    "node_type": "SEND_WHATSAPP",
    "status": "SUCCESS",
    "details": {...}
  }
]
```

---

## Response Object Structure

### WorkflowExecutionLogDTO

All endpoints return objects (or arrays of objects) with this structure:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique log entry ID |
| `workflow_execution_id` | string | ID of the workflow execution |
| `node_template_id` | string | ID of the node template |
| `node_type` | string | Type of node (SEND_WHATSAPP, SEND_EMAIL, QUERY, ACTION, etc.) |
| `status` | string | Execution status (RUNNING, SUCCESS, PARTIAL_SUCCESS, FAILED, SKIPPED) |
| `started_at` | timestamp | When execution started (ISO-8601) |
| `completed_at` | timestamp | When execution completed (ISO-8601) |
| `execution_time_ms` | number | Execution duration in milliseconds |
| `error_message` | string | Top-level error message (if failed) |
| `error_type` | string | Error type/category (if failed) |
| `created_at` | timestamp | Log creation timestamp |
| `updated_at` | timestamp | Log update timestamp |
| `details` | object | Node-specific execution details (see below) |

---

## Details JSON Structure by Node Type

The `details` field contains node-specific execution information.

### SEND_WHATSAPP / SEND_EMAIL Nodes

#### Success Case
```json
{
  "successCount": 50,
  "failureCount": 0,
  "skippedCount": 0,
  "executionTimeMs": 1200
}
```

#### Partial Success / Failure Case
```json
{
  "successCount": 48,
  "failureCount": 1,
  "skippedCount": 1,
  "executionTimeMs": 1500,
  "failedMessages": [
    {
      "index": 2,
      "mobileNumber": "null",
      "templateName": "everyday_template",
      "languageCode": "en",
      "templateVars": {
        "name": "John Doe",
        "habit_text": "Exercise daily"
      },
      "itemData": {
        "userId": "user-123",
        "name": "John Doe",
        "email": "john@example.com",
        "mobileNumber": "null"
      },
      "errorMessage": "Invalid mobile number",
      "errorType": "VALIDATION_ERROR",
      "failureReason": "SKIPPED"
    },
    {
      "index": null,
      "mobileNumber": "919875982739",
      "templateName": "everyday_template",
      "languageCode": "en",
      "templateVars": null,
      "itemData": {
        "userId": "user-456",
        "name": "Jane Smith",
        "mobileNumber": "919875982739"
      },
      "errorMessage": "Batch send failed: 404 Not Found",
      "errorType": "BATCH_SEND_ERROR",
      "failureReason": "FAILED"
    }
  ]
}
```

**Failed Message Object Fields:**
- `index`: Position in the original list (1-based, may be null for batch errors)
- `mobileNumber` / `email`: Recipient identifier
- `templateName`: Template used
- `languageCode`: Language code
- `templateVars`: Template variables used
- `itemData`: **Original item data** - use this to identify who failed
- `errorMessage`: Human-readable error description
- `errorType`: Error category (VALIDATION_ERROR, BATCH_SEND_ERROR, PROCESSING_ERROR, etc.)
- `failureReason`: "SKIPPED" (validation issue) or "FAILED" (system error)

---

### QUERY Node

```json
{
  "query": "fetch_students_by_package",
  "rowsReturned": 25,
  "executionTimeMs": 45
}
```

---

### ACTION Node

```json
{
  "actionType": "UPDATE_FIELD",
  "entityId": "student-123",
  "changes": {
    "status": "ACTIVE",
    "last_login": "2025-12-10T10:00:00Z"
  },
  "executionTimeMs": 20
}
```

---

### TRIGGER Node

```json
{
  "triggerType": "SCHEDULED",
  "cronExpression": "0 0 12 * * ?",
  "firedAt": "2025-12-10T12:00:00Z",
  "executionTimeMs": 5
}
```

---

## Status Definitions

| Status | Description |
|--------|-------------|
| `RUNNING` | Node is currently executing |
| `SUCCESS` | All items processed successfully (failureCount = 0, skippedCount = 0) |
| `PARTIAL_SUCCESS` | Some items succeeded, some failed or were skipped |
| `FAILED` | Node execution failed completely or all items failed |
| `SKIPPED` | Node was not executed (condition not met) |

---

## Error Handling

### 404 Not Found
```json
{
  "timestamp": "2025-12-10T10:00:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "No logs found for execution ID: invalid-id",
  "path": "/admin-core-service/workflow/logs/execution/invalid-id"
}
```

### 400 Bad Request
```json
{
  "timestamp": "2025-12-10T10:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Invalid time range: startTime must be before endTime",
  "path": "/admin-core-service/workflow/logs/time-range"
}
```

### 401 Unauthorized
```json
{
  "timestamp": "2025-12-10T10:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

---

## Frontend Integration Guide

### Displaying Execution Logs

1. **Fetch logs for an execution:**
   ```javascript
   const response = await fetch(`/admin-core-service/workflow/logs/execution/${executionId}`, {
     headers: { 'Authorization': `Bearer ${token}` }
   });
   const logs = await response.json();
   ```

2. **Check for failures:**
   ```javascript
   logs.forEach(log => {
     if (log.status === 'PARTIAL_SUCCESS' || log.status === 'FAILED') {
       // Show warning/error indicator
       if (log.details?.failedMessages) {
         // Display failed items
         log.details.failedMessages.forEach(failure => {
           console.log(`Failed: ${failure.itemData.name} - ${failure.errorMessage}`);
         });
       }
     }
   });
   ```

3. **Display failure details:**
   ```javascript
   // For batch nodes (SEND_WHATSAPP, SEND_EMAIL)
   if (log.node_type === 'SEND_WHATSAPP' && log.details?.failedMessages) {
     const failedUsers = log.details.failedMessages.map(f => ({
       name: f.itemData.name || f.itemData.userId,
       reason: f.errorMessage,
       type: f.failureReason // 'SKIPPED' or 'FAILED'
     }));
     // Render table/list of failed users
   }
   ```

---

## Best Practices

1. **Polling for Running Executions:**
    - Poll the execution endpoint every 2-5 seconds for logs with `status: "RUNNING"`
    - Stop polling when all logs show terminal status (SUCCESS, FAILED, PARTIAL_SUCCESS, SKIPPED)

2. **Error Display:**
    - Use color coding: Green (SUCCESS), Yellow (PARTIAL_SUCCESS), Red (FAILED), Gray (SKIPPED)
    - For PARTIAL_SUCCESS/FAILED, always check `details.failedMessages` array
    - Display `itemData` to help users identify which records failed

3. **Performance:**
    - Use pagination for time-range queries
    - Cache execution logs that are complete (not RUNNING)
    - Consider using WebSockets for real-time updates instead of polling

---

## Support

For issues or questions, please contact the backend team or create an issue in the repository.
