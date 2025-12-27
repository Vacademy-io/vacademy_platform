# LLM Analytics API Documentation

## Overview

The LLM Analytics API provides access to processed student activity data that has been analyzed by AI/LLM models. This data includes insights, analysis, and structured information about student learning activities.

**Base URL**: `https://backend-stage.vacademy.io/admin-core-service` (Stage Environment)

**Authentication**: Required - JWT Bearer Token

---

## API Endpoints

### Client/Frontend APIs

#### 1. Get Processed Activity Logs

**Endpoint**: `GET /admin-core-service/llm-analytics/processed-logs`

**Description**: Retrieves all processed activity logs for a specific user and either a slide_id or source_id. Returns the processed JSON data that contains LLM-generated insights and analysis.

**Authentication**: Required (JWT Token in Authorization header)

**Query Parameters**:

- `userId` (string, required): The user ID to fetch logs for
- `slideId` (string, optional): The slide ID to filter by (either this or sourceId must be provided)
- `sourceId` (string, optional): The source ID to filter by (either this or slideId must be provided)

**Validation**: At least one of `slideId` or `sourceId` must be provided. If both are provided, `slideId` takes precedence.

**Request Headers**:

```http
Authorization: Bearer <your-jwt-token>
```

**Example Requests**:

```
GET /admin-core-service/llm-analytics/processed-logs?userId=user-123&slideId=slide-456
GET /admin-core-service/llm-analytics/processed-logs?userId=user-123&sourceId=source-789
```

**Response** (Success - 200 OK):

```json
{
  "activity_logs": [
    {
      "id": "activity-log-001",
      "user_id": "user-123",
      "slide_id": "slide-456",
      "source_id": "source-789",
      "source_type": "VIDEO",
      "status": "processed",
      "processed_json": "{\"insights\": \"Student showed high engagement...\", \"concentration_score\": 85}",
      "created_at": "2024-12-15T10:30:00",
      "updated_at": "2024-12-15T10:35:00"
    },
    {
      "id": "activity-log-002",
      "user_id": "user-123",
      "slide_id": "slide-456",
      "source_id": "source-789",
      "source_type": "VIDEO",
      "status": "processed",
      "processed_json": "{\"insights\": \"Student completed viewing...\", \"engagement_level\": \"high\"}",
      "created_at": "2024-12-14T15:20:00",
      "updated_at": "2024-12-14T15:25:00"
    }
  ],
  "count": 2
}
```

**Response** (Error - 400 Bad Request):

```json
{
  "status": "error",
  "message": "Either slideId or sourceId must be provided"
}
```

**Response** (Error - 500 Internal Server Error):

```json
{
  "status": "error",
  "message": "Failed to fetch processed logs: <error details>"
}
```

**Notes**:

- Results are ordered by creation date (newest first)
- Only returns logs with status = "processed"
- The `processed_json` field contains the LLM-generated analysis as a JSON string

---

### Backend/Testing APIs

#### 2. Process All Raw Logs (Manual Trigger)

**Endpoint**: `POST /admin-core-service/llm-analytics/process-all`

**Description**: Manually triggers processing of all raw activity logs that haven't been processed yet. This is useful for testing or recovering from processing failures.

**Authentication**: Required (JWT Token in Authorization header)

**Request Headers**:

```http
Authorization: Bearer <your-jwt-token>
```

**Response** (Success - 200 OK):

```json
{
  "status": "success",
  "message": "Processing started for all raw activity logs"
}
```

**Response** (Error - 500 Internal Server Error):

```json
{
  "status": "error",
  "message": "Failed to process logs: <error details>"
}
```

**Use Case**: Trigger batch processing of accumulated raw logs for testing or maintenance.

---

#### 3. Reprocess Single Activity Log

**Endpoint**: `POST /admin-core-service/llm-analytics/reprocess/{activityLogId}`

**Description**: Manually reprocesses a specific activity log by ID. Useful for retrying failed processing or updating analysis with new LLM models.

**Authentication**: Required (JWT Token in Authorization header)

**Path Parameters**:

- `activityLogId` (string, required): The activity log ID to reprocess

**Request Headers**:

```http
Authorization: Bearer <your-jwt-token>
```

**Example Request**:

```
POST /admin-core-service/llm-analytics/reprocess/activity-log-123
```

**Response** (Success - 200 OK):

```json
{
  "status": "success",
  "message": "Activity log reprocessing started",
  "activityLogId": "activity-log-123"
}
```

**Response** (Error - 500 Internal Server Error):

```json
{
  "status": "error",
  "message": "Failed to reprocess log: <error details>"
}
```

**Use Case**: Reprocess a specific log after fixing data issues or updating LLM prompts.

---

#### 4. Health Check

**Endpoint**: `GET /admin-core-service/llm-analytics/health`

**Description**: Health check endpoint to verify the LLM analytics service is running.

**Authentication**: Required (JWT Token in Authorization header)

**Request Headers**:

```http
Authorization: Bearer <your-jwt-token>
```

**Response** (Success - 200 OK):

```json
{
  "status": "healthy",
  "message": "LLM Analytics service is running"
}
```

**Use Case**: Monitor service availability in health check dashboards.

---

#### 5. Get Scheduler Status

**Endpoint**: `GET /admin-core-service/llm-analytics/scheduler/status`

**Description**: Returns information about the LLM processing scheduler including last run time, pending logs count, and processing statistics.

**Authentication**: Required (JWT Token in Authorization header)

**Request Headers**:

```http
Authorization: Bearer <your-jwt-token>
```

**Response** (Success - 200 OK):

```json
{
  "status": "active",
  "last_run": "2024-12-19T10:30:00",
  "pending_logs": 25,
  "processed_today": 150,
  "failed_today": 2,
  "next_scheduled_run": "2024-12-19T11:00:00"
}
```

**Use Case**: Monitor scheduler performance and queue status.

---

#### 6. Trigger Scheduler (Manual)

**Endpoint**: `POST /admin-core-service/llm-analytics/scheduler/trigger`

**Description**: Manually triggers the scheduled processing job. This runs the same job that executes automatically on schedule.

**Authentication**: Required (JWT Token in Authorization header)

**Request Headers**:

```http
Authorization: Bearer <your-jwt-token>
```

**Response** (Success - 200 OK):

```json
{
  "status": "success",
  "message": "Scheduler job triggered successfully"
}
```

**Response** (Error - 500 Internal Server Error):

```json
{
  "status": "error",
  "message": "Failed to trigger scheduler: <error details>"
}
```

**Use Case**: Force immediate processing without waiting for the next scheduled run.

---

### Internal/Microservice APIs

#### 7. Save Assessment Data (Internal)

**Endpoint**: `POST /admin-core-service/llm-analytics/assessment`

**Description**: Internal API endpoint called by assessment_service when a student submits an assessment. Saves enriched assessment data for LLM processing.

**Authentication**: HMAC Authentication (not JWT)

**Request Headers**:

```http
clientName: assessment_service
Signature: <HMAC-SHA256-signature>
Content-Type: application/json
```

**Request Body**:

```json
{
  "activity_type": "assessment_attempt",
  "timestamp": "2024-12-19T10:30:00Z",
  "assessment": {
    "id": "assessment-123",
    "name": "Math Quiz Chapter 5",
    "type": "QUIZ",
    "total_marks": 100
  },
  "attempt": {
    "id": "attempt-456",
    "attempt_number": 1,
    "user_id": "user-789",
    "start_time": "2024-12-19T10:00:00Z",
    "end_time": "2024-12-19T10:30:00Z",
    "time_taken_minutes": 30
  },
  "summary": {
    "total_score": 85,
    "percentage": 85.0,
    "total_questions": 20,
    "correct_answers": 17,
    "incorrect_answers": 3
  },
  "sections": [
    {
      "section_id": "section-1",
      "section_name": "Algebra",
      "questions": [
        {
          "question_id": "q1",
          "question_text": "Solve for x: 2x + 5 = 15",
          "question_type": "MCQ",
          "options": [
            {
              "option_id": "opt1",
              "option_text": "5",
              "is_correct": true
            }
          ],
          "student_response": {
            "selected_option_id": "opt1",
            "is_correct": true,
            "marks_obtained": 5
          }
        }
      ]
    }
  ]
}
```

**Response** (Success - 200 OK):

```json
{
  "success": true,
  "message": "Assessment data saved for LLM analysis"
}
```

**Response** (Error - 500 Internal Server Error):

```json
{
  "success": false,
  "message": "Error saving assessment data: <error details>"
}
```

**Use Case**: Called automatically by assessment_service after student submits assessment. Not for direct frontend use.

**Note**: This endpoint uses HMAC authentication, not JWT. It's configured in the security config to allow internal microservice communication.

---

## Data Structure

### ProcessedActivityLogItem Object

| Field            | Type     | Description                                                |
| ---------------- | -------- | ---------------------------------------------------------- |
| `id`             | string   | Unique identifier for the activity log                     |
| `user_id`        | string   | ID of the user who performed the activity                  |
| `slide_id`       | string   | ID of the slide (if applicable)                            |
| `source_id`      | string   | ID of the source content (video, document, etc.)           |
| `source_type`    | string   | Type of source: VIDEO, DOCUMENT, QUIZ, etc.                |
| `status`         | string   | Processing status (always "processed" for this endpoint)   |
| `processed_json` | string   | JSON string containing LLM-generated insights and analysis |
| `created_at`     | datetime | When the activity log was created (ISO 8601)               |
| `updated_at`     | datetime | When the activity log was last updated (ISO 8601)          |

### ProcessedActivityLogsResponse Object

| Field           | Type    | Description                               |
| --------------- | ------- | ----------------------------------------- |
| `activity_logs` | array   | Array of ProcessedActivityLogItem objects |
| `count`         | integer | Total number of processed logs returned   |

---

## Error Handling

### Common Errors

| Status Code | Error                 | Solution                                                  |
| ----------- | --------------------- | --------------------------------------------------------- |
| 400         | Missing parameters    | Ensure userId and either slideId or sourceId are provided |
| 401         | Unauthorized          | Check that JWT token is valid and included in headers     |
| 500         | Internal server error | Check server logs, retry request                          |

---

## Best Practices

1. **Parameter Validation**: Always validate that either slideId or sourceId is provided before making the request
2. **JSON Parsing**: The `processed_json` field is a string - always parse it before using
3. **Error Handling**: Implement proper try-catch blocks to handle network and parsing errors
4. **Caching**: Consider caching processed logs client-side as they don't change frequently
5. **Loading States**: Show loading indicators while fetching data
6. **Empty States**: Handle cases where no processed logs are found

---

## API Summary Table

| Endpoint                           | Method | Type            | Purpose                                         |
| ---------------------------------- | ------ | --------------- | ----------------------------------------------- |
| `/llm-analytics/processed-logs`    | GET    | Client          | Fetch processed activity logs with LLM insights |
| `/llm-analytics/process-all`       | POST   | Backend/Testing | Manually process all raw logs                   |
| `/llm-analytics/reprocess/{id}`    | POST   | Backend/Testing | Reprocess a specific activity log               |
| `/llm-analytics/health`            | GET    | Backend/Testing | Health check for service                        |
| `/llm-analytics/scheduler/status`  | GET    | Backend/Testing | Get scheduler status and statistics             |
| `/llm-analytics/scheduler/trigger` | POST   | Backend/Testing | Manually trigger scheduled job                  |
| `/llm-analytics/assessment`        | POST   | Internal        | Save assessment data from assessment_service    |

---

## Related APIs

- **Student Analysis Report**: `/admin-core-service/v1/student-analysis/*` - Aggregate student analysis over time periods
- **Activity Tracking**: `/admin-core-service/learner-tracking/*` - Raw activity tracking endpoints

---

## Changelog

| Version | Date       | Changes                                                   |
| ------- | ---------- | --------------------------------------------------------- |
| 1.0.0   | 2024-12-19 | Initial API documentation for processed logs endpoint     |
| 1.1.0   | 2024-12-19 | Added all backend/testing and internal APIs documentation |

---
