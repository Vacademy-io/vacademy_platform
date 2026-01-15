# Audience & Enquiry API Documentation

## Overview
This document provides comprehensive API documentation for the Audience Campaign and Enquiry Management system. These APIs are designed for frontend integration to manage marketing campaigns, lead submissions, and enquiry tracking.

---

## Base URL
```
http://localhost:8072/admin-core-service/v1/audience
```

---

## Table of Contents
1. [Create Campaign](#1-create-campaign)
2. [Get Campaigns (List/Filter)](#2-get-campaigns-listfilter)
3. [Submit Lead with Enquiry](#3-submit-lead-with-enquiry)
4. [Get Enquiries (List/Filter)](#4-get-enquiries-listfilter)

---

## 1. Create Campaign

Create a new audience campaign for lead generation.

### Endpoint
```
POST /admin-core-service/v1/audience/campaign
```

### Headers
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

### Request Body
```json
{
  "institute_id": "inst-123",
  "campaign_name": "Summer Admission 2026",
  "campaign_type": "ADMISSION",
  "description": "Campaign for summer admission season",
  "campaign_objective": "Generate leads for summer batch",
  "start_date_local": "2026-06-01T00:00:00",
  "end_date_local": "2026-08-31T23:59:59",
  "status": "ACTIVE",
  "to_notify": "admin@example.com,sales@example.com",
  "send_respondent_email": true,
  "session_id": "session-456",
  "setting_json": "{\"form_theme\": \"light\", \"redirect_url\": \"https://example.com/thank-you\"}",
  "institute_custom_fields": [
    {
      "institute_id": "inst-123",
      "custom_field_id": "field-789",
      "source_type": "AUDIENCE_FORM",
      "source_id": "",
      "field_name": "Phone Number",
      "is_mandatory": true,
      "display_order": 1
    },
    {
      "institute_id": "inst-123",
      "custom_field_id": "field-790",
      "source_type": "AUDIENCE_FORM",
      "source_id": "",
      "field_name": "City",
      "is_mandatory": false,
      "display_order": 2
    }
  ]
}
```

### Field Descriptions
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `institute_id` | string | Yes | Institute identifier |
| `campaign_name` | string | Yes | Name of the campaign |
| `campaign_type` | string | No | Type (ADMISSION, WEBINAR, EVENT, etc.) |
| `description` | string | No | Campaign description |
| `campaign_objective` | string | No | Goal of the campaign |
| `start_date_local` | timestamp | No | Campaign start date |
| `end_date_local` | timestamp | No | Campaign end date |
| `status` | string | No | ACTIVE, PAUSED, COMPLETED (default: ACTIVE) |
| `to_notify` | string | No | Comma-separated emails to notify on lead submission |
| `send_respondent_email` | boolean | No | Send confirmation email to respondent (default: true) |
| `session_id` | string | No | Related session/course ID |
| `setting_json` | string | No | JSON string with additional settings |
| `institute_custom_fields` | array | No | Custom form fields for this campaign |

### Response
```json
"campaign-uuid-12345"
```

### CURL Example
```bash
curl -X POST "http://localhost:8072/admin-core-service/v1/audience/campaign" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "institute_id": "inst-123",
    "campaign_name": "Summer Admission 2026",
    "campaign_type": "ADMISSION",
    "status": "ACTIVE",
    "to_notify": "admin@example.com",
    "send_respondent_email": true
  }'
```

### Success Response
- **Code**: 200 OK
- **Content**: Campaign ID (string)

### Error Response
- **Code**: 400 Bad Request
- **Content**: `{"message": "Campaign name is required"}`

---

## 2. Get Campaigns (List/Filter)

Retrieve campaigns with filtering and pagination.

### Endpoint
```
POST /admin-core-service/v1/audience/campaigns
```

### Headers
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pageNo` | integer | 0 | Page number (0-indexed) |
| `pageSize` | integer | 20 | Items per page |

### Request Body
```json
{
  "institute_id": "inst-123",
  "status": "ACTIVE",
  "campaign_type": "ADMISSION",
  "campaign_name": "Summer",
  "start_date_from_local": "2026-01-01T00:00:00",
  "start_date_to_local": "2026-12-31T23:59:59",
  "page": 0,
  "size": 20
}
```

### Field Descriptions
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `institute_id` | string | Yes | Institute identifier |
| `status` | string | No | Filter by status (ACTIVE, PAUSED, etc.) |
| `campaign_type` | string | No | Filter by campaign type |
| `campaign_name` | string | No | Search by campaign name (partial match) |
| `start_date_from_local` | timestamp | No | Filter campaigns starting from this date |
| `start_date_to_local` | timestamp | No | Filter campaigns starting before this date |
| `page` | integer | No | Page number (overrides query param) |
| `size` | integer | No | Page size (overrides query param) |

### Response
```json
{
  "content": [
    {
      "id": "campaign-uuid-12345",
      "institute_id": "inst-123",
      "campaign_name": "Summer Admission 2026",
      "campaign_type": "ADMISSION",
      "description": "Campaign for summer admission season",
      "campaign_objective": "Generate leads for summer batch",
      "start_date_local": "2026-06-01T00:00:00",
      "end_date_local": "2026-08-31T23:59:59",
      "status": "ACTIVE",
      "json_web_metadata": null,
      "to_notify": "admin@example.com,sales@example.com",
      "send_respondent_email": true,
      "session_id": "session-456",
      "setting_json": "{\"form_theme\": \"light\"}",
      "created_by_user_id": "user-789",
      "institute_custom_fields": []
    }
  ],
  "pageable": {
    "sort": {
      "empty": false,
      "sorted": true,
      "unsorted": false
    },
    "offset": 0,
    "pageNumber": 0,
    "pageSize": 20,
    "paged": true,
    "unpaged": false
  },
  "totalPages": 5,
  "totalElements": 95,
  "last": false,
  "size": 20,
  "number": 0,
  "sort": {
    "empty": false,
    "sorted": true,
    "unsorted": false
  },
  "numberOfElements": 20,
  "first": true,
  "empty": false
}
```

### CURL Example
```bash
curl -X POST "http://localhost:8072/admin-core-service/v1/audience/campaigns?pageNo=0&pageSize=20" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "institute_id": "inst-123",
    "status": "ACTIVE"
  }'
```

### Success Response
- **Code**: 200 OK
- **Content**: Page of campaigns

---

## 3. Submit Lead with Enquiry

Submit a lead form response along with enquiry details (public endpoint for form submissions).

### Endpoint
```
POST /admin-core-service/open/v1/audience/lead/submit-with-enquiry
```

### Headers
```json
{
  "Content-Type": "application/json"
}
```

**Note**: This is a public endpoint and does not require authentication.

### Request Body
```json
{
  "audience_id": "campaign-uuid-12345",
  "source_type": "WEBSITE",
  "source_id": "landing-page-1",
  "destination_package_session_id": "session-789",
  "parent_name": "John Doe Sr.",
  "parent_email": "john.senior@example.com",
  "parent_mobile": "+1234567890",
  "user_dto": {
    "full_name": "John Doe",
    "email": "john.doe@example.com",
    "mobile_number": "+1234567890",
    "date_of_birth": "2010-05-15",
    "gender": "MALE"
  },
  "custom_field_values": {
    "field-789": "+1234567890",
    "field-790": "New York",
    "field-791": "Interested in Computer Science"
  },
  "enquiry": {
    "checklist": "Documents verified, Follow-up scheduled",
    "enquiry_status": "NEW",
    "convertion_status": "PENDING",
    "reference_source": "Google Ads",
    "assigned_user_id": false,
    "assigned_visit_session_id": false,
    "fee_range_expectation": "$5000-$8000",
    "transport_requirement": "School bus required",
    "mode": "ONLINE",
    "enquiry_tracking_id": "ENQ-2026-001",
    "interest_score": 85,
    "notes": "Parent is very interested, wants to schedule a campus visit"
  }
}
```

### Field Descriptions

#### Main Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audience_id` | string | Yes | Campaign ID to submit lead for |
| `source_type` | string | No | Lead source (WEBSITE, GOOGLE_ADS, FACEBOOK, etc.) |
| `source_id` | string | No | Specific source identifier |
| `destination_package_session_id` | string | No | Target session/package ID |
| `parent_name` | string | No | Parent/guardian name |
| `parent_email` | string | No | Parent/guardian email |
| `parent_mobile` | string | No | Parent/guardian mobile |
| `user_dto` | object | Yes | Student/user information |
| `custom_field_values` | object | No | Custom form field values (key: custom_field_id, value: user input) |
| `enquiry` | object | No | Enquiry tracking information |

#### user_dto Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `full_name` | string | No | Student full name |
| `email` | string | Yes | Student email (unique identifier) |
| `mobile_number` | string | No | Student mobile |
| `date_of_birth` | string | No | Date of birth (YYYY-MM-DD) |
| `gender` | string | No | MALE, FEMALE, OTHER |

#### enquiry Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `checklist` | string | No | Checklist items completed |
| `enquiry_status` | string | No | NEW, CONTACTED, QUALIFIED, CONVERTED, LOST |
| `convertion_status` | string | No | Conversion tracking status |
| `reference_source` | string | No | How they heard about you |
| `assigned_user_id` | boolean | No | Is a user assigned to this enquiry |
| `assigned_visit_session_id` | boolean | No | Is a visit session scheduled |
| `fee_range_expectation` | string | No | Expected fee range |
| `transport_requirement` | string | No | Transportation needs |
| `mode` | string | No | ONLINE, OFFLINE, HYBRID |
| `enquiry_tracking_id` | string | No | Custom tracking ID |
| `interest_score` | integer | No | Interest level (0-100) |
| `notes` | string | No | Additional notes |

### Response
```json
{
  "enquiry_id": "enquiry-uuid-456",
  "audience_response_id": "response-uuid-789",
  "user_id": "user-uuid-123",
  "message": "Lead and enquiry submitted successfully"
}
```

### CURL Example
```bash
curl -X POST "http://localhost:8072/admin-core-service/open/v1/audience/lead/submit-with-enquiry" \
  -H "Content-Type: application/json" \
  -d '{
    "audience_id": "campaign-uuid-12345",
    "source_type": "WEBSITE",
    "parent_name": "John Doe Sr.",
    "parent_email": "john.senior@example.com",
    "user_dto": {
      "full_name": "John Doe",
      "email": "john.doe@example.com",
      "mobile_number": "+1234567890"
    },
    "custom_field_values": {
      "field-789": "+1234567890",
      "field-790": "New York"
    },
    "enquiry": {
      "enquiry_status": "NEW",
      "convertion_status": "PENDING",
      "interest_score": 85,
      "notes": "Very interested student"
    }
  }'
```

### Success Response
- **Code**: 200 OK
- **Content**: Submission details with IDs

### Error Responses
- **Code**: 400 Bad Request - `{"message": "Audience not found"}`
- **Code**: 400 Bad Request - `{"message": "User information is required"}`
- **Code**: 400 Bad Request - `{"message": "You have already submitted your response for this campaign"}`

---

## 4. Get Enquiries (List/Filter)

Retrieve enquiries with audience responses, user details, and custom fields.

### Endpoint
```
POST /admin-core-service/v1/audience/enquiries
```

### Headers
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pageNo` | integer | 0 | Page number (0-indexed) |
| `pageSize` | integer | 20 | Items per page |

### Request Body
```json
{
  "audience_id": "campaign-uuid-12345",
  "status": "NEW",
  "source": "WEBSITE",
  "destination_package_session_id": "session-789",
  "created_from": "2026-01-01T00:00:00",
  "created_to": "2026-01-31T23:59:59",
  "page": 0,
  "size": 20
}
```

### Field Descriptions
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audience_id` | string | Yes | Campaign ID to filter enquiries |
| `status` | string | No | Filter by enquiry_status (NEW, CONTACTED, etc.) |
| `source` | string | No | Filter by source_type (WEBSITE, GOOGLE_ADS, etc.) |
| `destination_package_session_id` | string | No | Filter by target session |
| `created_from` | timestamp | No | Filter enquiries created from this date |
| `created_to` | timestamp | No | Filter enquiries created before this date |
| `page` | integer | No | Page number (overrides query param) |
| `size` | integer | No | Page size (overrides query param) |

### Response
```json
{
  "content": [
    {
      "enquiry_id": "enquiry-uuid-456",
      "checklist": "Documents verified, Follow-up scheduled",
      "enquiry_status": "NEW",
      "convertion_status": "PENDING",
      "reference_source": "Google Ads",
      "assigned_user_id": false,
      "assigned_visit_session_id": false,
      "fee_range_expectation": "$5000-$8000",
      "transport_requirement": "School bus required",
      "mode": "ONLINE",
      "enquiry_tracking_id": "ENQ-2026-001",
      "interest_score": 85,
      "notes": "Parent is very interested, wants to schedule a campus visit",
      "enquiry_created_at": "2026-01-15T10:30:00",
      "audience_response_id": "response-uuid-789",
      "audience_id": "campaign-uuid-12345",
      "source_type": "WEBSITE",
      "source_id": "landing-page-1",
      "destination_package_session_id": "session-789",
      "parent_name": "John Doe Sr.",
      "parent_email": "john.senior@example.com",
      "parent_mobile": "+1234567890",
      "submitted_at": "2026-01-15T10:30:00",
      "user": {
        "id": "user-uuid-123",
        "full_name": "John Doe",
        "email": "john.doe@example.com",
        "mobile_number": "+1234567890",
        "date_of_birth": "2010-05-15",
        "gender": "MALE"
      },
      "custom_fields": {
        "field-789": "+1234567890",
        "field-790": "New York",
        "field-791": "Interested in Computer Science"
      }
    }
  ],
  "pageable": {
    "sort": {
      "empty": true,
      "sorted": false,
      "unsorted": true
    },
    "offset": 0,
    "pageNumber": 0,
    "pageSize": 20,
    "paged": true,
    "unpaged": false
  },
  "totalPages": 3,
  "totalElements": 47,
  "last": false,
  "size": 20,
  "number": 0,
  "sort": {
    "empty": true,
    "sorted": false,
    "unsorted": true
  },
  "numberOfElements": 20,
  "first": true,
  "empty": false
}
```

### Response Field Descriptions

#### Enquiry Fields
| Field | Type | Description |
|-------|------|-------------|
| `enquiry_id` | UUID | Unique enquiry identifier |
| `enquiry_status` | string | Current status (NEW, CONTACTED, etc.) |
| `convertion_status` | string | Conversion tracking |
| `interest_score` | integer | Interest level (0-100) |
| `enquiry_created_at` | timestamp | When enquiry was created |

#### Audience Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `audience_response_id` | string | Response/lead ID |
| `audience_id` | string | Campaign ID |
| `source_type` | string | Lead source |
| `destination_package_session_id` | string | Target session |
| `parent_name` | string | Parent/guardian name |
| `submitted_at` | timestamp | When form was submitted |

#### User Object
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | User ID |
| `full_name` | string | User full name |
| `email` | string | User email |
| `mobile_number` | string | User mobile |

#### Custom Fields
- **Type**: Object (Map)
- **Format**: `{ "custom_field_id": "value" }`
- **Description**: All custom form field values submitted by the user

### CURL Example
```bash
curl -X POST "http://localhost:8072/admin-core-service/v1/audience/enquiries?pageNo=0&pageSize=20" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "audience_id": "campaign-uuid-12345",
    "status": "NEW",
    "source": "WEBSITE",
    "created_from": "2026-01-01T00:00:00",
    "created_to": "2026-01-31T23:59:59"
  }'
```

### Success Response
- **Code**: 200 OK
- **Content**: Page of enquiries with full details

---

## Common Use Cases

### 1. Create a Campaign and Get Its Form Fields
```javascript
// Step 1: Create campaign
const campaignResponse = await fetch('/admin-core-service/v1/audience/campaign', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    institute_id: 'inst-123',
    campaign_name: 'Summer Admission 2026',
    status: 'ACTIVE',
    institute_custom_fields: [
      { custom_field_id: 'field-phone', field_name: 'Phone', is_mandatory: true }
    ]
  })
});
const campaignId = await campaignResponse.json();

// Step 2: Public user submits form
const submitResponse = await fetch('/admin-core-service/open/v1/audience/lead/submit-with-enquiry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    audience_id: campaignId,
    user_dto: { email: 'student@example.com', full_name: 'Student Name' },
    custom_field_values: { 'field-phone': '1234567890' },
    enquiry: { enquiry_status: 'NEW', interest_score: 90 }
  })
});
```

### 2. Filter and Export Enquiries
```javascript
// Get all NEW enquiries from last month
const enquiriesResponse = await fetch('/admin-core-service/v1/audience/enquiries', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    audience_id: 'campaign-uuid-12345',
    status: 'NEW',
    created_from: '2026-01-01T00:00:00',
    created_to: '2026-01-31T23:59:59',
    page: 0,
    size: 100
  })
});
const enquiries = await enquiriesResponse.json();
```

### 3. Search Campaigns and View Leads
```javascript
// Search for active admission campaigns
const campaignsResponse = await fetch('/admin-core-service/v1/audience/campaigns', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    institute_id: 'inst-123',
    status: 'ACTIVE',
    campaign_type: 'ADMISSION'
  })
});
const campaigns = await campaignsResponse.json();
```

---

## Error Handling

### Common Error Codes
| Code | Message | Solution |
|------|---------|----------|
| 400 | "Campaign name is required" | Provide campaign_name in request |
| 400 | "Audience not found" | Verify audience_id exists |
| 400 | "User information is required" | Provide user_dto with email |
| 400 | "Duplicate submission" | User already submitted for this campaign |
| 401 | "Unauthorized" | Check JWT token validity |
| 403 | "Forbidden" | User doesn't have permission |
| 500 | "Internal Server Error" | Contact backend team |

### Example Error Response
```json
{
  "timestamp": "2026-01-15T12:30:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Campaign name is required",
  "path": "/admin-core-service/v1/audience/campaign"
}
```

---

## Notes for Frontend Integration

1. **Authentication**: All admin endpoints require JWT token except `/open/v1/audience/lead/submit-with-enquiry`
2. **Pagination**: Both query params and request body pagination are supported. Body values override query params.
3. **Date Format**: Use ISO-8601 format: `YYYY-MM-DDTHH:mm:ss`
4. **Custom Fields**: Map custom_field_id to values in `custom_field_values` object
5. **Batch Operations**: Use pagination to handle large datasets
6. **Real-time**: Consider implementing polling or WebSockets for real-time enquiry updates

---

## Frontend Implementation Checklist

- [ ] Create campaign form with validation
- [ ] Implement campaign listing with filters
- [ ] Build public lead submission form
- [ ] Create enquiry dashboard with filters
- [ ] Add pagination controls
- [ ] Implement error handling and user feedback
- [ ] Add loading states for all API calls
- [ ] Test with different date ranges and filters
- [ ] Implement export functionality for enquiries
- [ ] Add real-time notification for new enquiries

---

## Contact & Support

For API issues or questions, contact:
- **Backend Team**: backend@example.com
- **API Documentation**: [Swagger/OpenAPI URL]
- **Issue Tracker**: [JIRA/GitHub URL]

---

**Last Updated**: January 15, 2026  
**API Version**: v1  
**Document Version**: 1.0
