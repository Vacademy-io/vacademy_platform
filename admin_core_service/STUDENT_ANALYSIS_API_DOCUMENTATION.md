# Student Analysis Report API Documentation

## Overview

The Student Analysis Report API provides comprehensive insights into student learning patterns, performance, and behavior over a specified time period. The API uses an asynchronous processing model where you initiate analysis and then poll for results.

**Base URL**: `https://backend-stage.vacademy.io/admin-core-service` (Stage Environment)

**Authentication**: Required - JWT Bearer Token

---

## API Endpoints

### 1. Initiate Student Analysis

**Endpoint**: `POST /admin-core-service/v1/student-analysis/initiate`

**Description**: Starts asynchronous processing of a student analysis report. Returns a unique process ID that can be used to check the status and retrieve the final report.

**Authentication**: Required (JWT Token in Authorization header)

**Request Headers**:

```http
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "user_id": "string", // Required - Student's user ID
  "institute_id": "string", // Required - Institute ID
  "start_date_iso": "2024-01-01", // Required - Start date in ISO 8601 format (YYYY-MM-DD)
  "end_date_iso": "2024-01-31" // Required - End date in ISO 8601 format (YYYY-MM-DD)
}
```

**Response** (Success - 200 OK):

```json
{
  "process_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "message": "Student analysis processing initiated successfully"
}
```

**Response** (Error - 500 Internal Server Error):

```json
{
  "process_id": null,
  "status": "ERROR",
  "message": "Failed to initiate analysis: <error details>"
}
```

**Status Values**:

- `PENDING`: Analysis has been queued for processing
- `PROCESSING`: Analysis is currently being processed
- `COMPLETED`: Analysis is complete and report is ready
- `FAILED`: Analysis failed (check error_message in report endpoint)

---

### 2. Get Student Analysis Report

**Endpoint**: `GET /admin-core-service/v1/student-analysis/report/{processId}`

**Description**: Retrieves the status and report data for a previously initiated analysis process.

**Authentication**: Required (JWT Token in Authorization header)

**Path Parameters**:

- `processId` (string, required): The process ID returned from the initiate endpoint

**Request Headers**:

```http
Authorization: Bearer <your-jwt-token>
```

**Response** (Success - 200 OK, Processing):

```json
{
  "process_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PROCESSING",
  "report": null,
  "error_message": null
}
```

**Response** (Success - 200 OK, Completed):

```json
{
  "process_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "COMPLETED",
  "report": {
    "learning_frequency": "## Learning Frequency Analysis\n\nThe student has been moderately active during this period...",
    "progress": "## Overall Progress\n\nThe student has shown consistent improvement...",
    "topics_of_improvement": "## Areas of Improvement\n\n- Mathematics: 85% proficiency\n- Science: 78% proficiency...",
    "topics_of_degradation": "## Areas Needing Attention\n\n- English Literature: Declined from 75% to 65%...",
    "remedial_points": "## Recommended Remedial Actions\n\n1. Focus on grammar fundamentals\n2. Practice more reading comprehension...",
    "strengths": {
      "Mathematics": 85,
      "Physics": 82,
      "Chemistry": 80
    },
    "weaknesses": {
      "English Literature": 65,
      "History": 68
    }
  },
  "error_message": null
}
```

**Response** (Failed):

```json
{
  "process_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "FAILED",
  "report": null,
  "error_message": "Insufficient data for analysis: No activity logs found in the specified date range"
}
```

**Response** (Error - 500 Internal Server Error):

```json
{
  "process_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ERROR",
  "report": null,
  "error_message": "Failed to fetch report: <error details>"
}
```

---

### 3. Get All Completed Reports for a User

**Endpoint**: `GET /admin-core-service/v1/student-analysis/reports/user/{userId}`

**Description**: Retrieves a paginated list of all completed analysis reports for a specific user, ordered by creation date (newest first).

**Authentication**: Required (JWT Token in Authorization header)

**Path Parameters**:

- `userId` (string, required): The user ID to fetch reports for

**Query Parameters**:

- `page` (integer, optional, default: 0): Page number (0-indexed)
- `size` (integer, optional, default: 10): Number of items per page

**Request Headers**:

```http
Authorization: Bearer <your-jwt-token>
```

**Example Request**:

```
GET /admin-core-service/v1/student-analysis/reports/user/user-123?page=0&size=10
```

**Response** (Success - 200 OK):

```json
{
  "reports": [
    {
      "process_id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "user-123",
      "institute_id": "inst-456",
      "start_date_iso": "2024-01-01",
      "end_date_iso": "2024-01-31",
      "status": "COMPLETED",
      "created_at": "2024-01-31T10:30:00",
      "updated_at": "2024-01-31T10:31:45",
      "report": {
        "learning_frequency": "## Learning Frequency Analysis\n\nThe student has been moderately active during this period...",
        "progress": "## Overall Progress\n\nThe student has shown consistent improvement...",
        "topics_of_improvement": "## Areas of Improvement\n\n- Mathematics: 85% proficiency\n- Science: 78% proficiency...",
        "topics_of_degradation": "## Areas Needing Attention\n\n- English Literature: Declined from 75% to 65%...",
        "remedial_points": "## Recommended Remedial Actions\n\n1. Focus on grammar fundamentals\n2. Practice more reading comprehension...",
        "strengths": {
          "Mathematics": 85,
          "Physics": 82,
          "Chemistry": 80
        },
        "weaknesses": {
          "English Literature": 65,
          "History": 68
        }
      }
    },
    {
      "process_id": "660e8400-e29b-41d4-a716-446655440111",
      "user_id": "user-123",
      "institute_id": "inst-456",
      "start_date_iso": "2023-12-01",
      "end_date_iso": "2023-12-31",
      "status": "COMPLETED",
      "created_at": "2023-12-31T15:20:00",
      "updated_at": "2023-12-31T15:22:30",
      "report": {
        "learning_frequency": "## Learning Frequency Analysis\n\nThe student showed high engagement during December...",
        "progress": "## Overall Progress\n\nExcellent progress in technical subjects...",
        "topics_of_improvement": "## Areas of Improvement\n\n- Computer Science: 92% proficiency\n- Physics: 88% proficiency...",
        "topics_of_degradation": "## Areas Needing Attention\n\n- Social Studies: Declined from 70% to 62%...",
        "remedial_points": "## Recommended Remedial Actions\n\n1. Review social studies fundamentals\n2. Practice current affairs...",
        "strengths": {
          "Computer Science": 92,
          "Mathematics": 87,
          "Physics": 88
        },
        "weaknesses": {
          "Social Studies": 62,
          "Geography": 65
        }
      }
    }
  ],
  "current_page": 0,
  "total_pages": 3,
  "total_elements": 25,
  "page_size": 10
}
```

**Response** (Error - 500 Internal Server Error):

```json
{
  "reports": [],
  "current_page": 0,
  "total_pages": 0,
  "total_elements": 0,
  "page_size": 10
}
```

---

## Report Data Structure

### StudentReportData Object

| Field                   | Type              | Description                                                      |
| ----------------------- | ----------------- | ---------------------------------------------------------------- |
| `learning_frequency`    | string (markdown) | Analysis of student's learning frequency and engagement patterns |
| `progress`              | string (markdown) | Overall progress assessment and trends                           |
| `topics_of_improvement` | string (markdown) | Topics where student has shown improvement                       |
| `topics_of_degradation` | string (markdown) | Topics where student performance has declined                    |
| `remedial_points`       | string (markdown) | Recommended remedial actions and focus areas                     |
| `strengths`             | object            | Map of topic names to proficiency percentages (0-100)            |
| `weaknesses`            | object            | Map of topic names to proficiency percentages (0-100)            |

**Note**: All markdown fields support full markdown formatting including headers, lists, bold, italic, etc.

## Error Handling

### Common Error Scenarios

| Error                       | Cause                                 | Solution                                                 |
| --------------------------- | ------------------------------------- | -------------------------------------------------------- |
| `401 Unauthorized`          | Missing or invalid JWT token          | Ensure user is logged in and token is valid              |
| `404 Not Found`             | Invalid process ID                    | Verify the process ID from initiate response             |
| `500 Internal Server Error` | Server-side processing error          | Check error_message in response, retry if temporary      |
| `FAILED` status             | Insufficient data or processing error | Check error_message, verify date range has activity data |

## Data Sources

The student analysis report aggregates data from multiple sources:

1. **Activity Logs**: Assessment attempts, video watching, slide interactions
2. **Login Statistics**: Login frequency, session duration, active time
3. **Learner Operations**: Video progress, chapter completion, module engagement

---

## Security & Authorization

- **Authentication**: All endpoints require a valid JWT Bearer token
- **Authorization**: User must have appropriate permissions to view student data
- **Institute Scope**: Analysis is scoped to the specified institute_id
- **User Privacy**: Ensure proper authorization before requesting student reports

## Changelog

| Version | Date       | Changes                                                                |
| ------- | ---------- | ---------------------------------------------------------------------- |
| 1.0.0   | 2024-12-19 | Initial API documentation                                              |
| 1.1.0   | 2024-12-19 | Added paginated endpoint for fetching all completed reports for a user |

---
