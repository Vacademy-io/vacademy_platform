# Announcement System API Usage Guide

## Overview
The Announcement System provides open APIs for internal service communication. No JWT authentication is required - all user details are provided in the request.

## Base URL
```
http://notification-service:8076/notification-service/v1
```

## Security Configuration
- ✅ **Open APIs**: No authentication required
- ✅ **Internal Use**: Designed for inter-service communication
- ✅ **Request-based Identity**: User details come from request, not JWT
- ✅ **Network Security**: Should be used within private network only

## Core APIs

### 1. Create Announcement
Create a new announcement for delivery to users.

**Endpoint:** `POST /announcements`

**Request Body:**
```json
{
  "title": "Assignment Due Tomorrow",
  "content": {
    "type": "html",
    "content": "<p>Please submit your <strong>Math Assignment</strong> by tomorrow 5 PM.</p>"
  },
  "instituteId": "institute_123",
  "createdBy": "user_456",
  "createdByName": "John Smith",
  "createdByRole": "TEACHER",
  "timezone": "Asia/Kolkata",
  "recipients": [
    {
      "recipientType": "PACKAGE_SESSION",
      "recipientId": "math_8th_2024",
      "recipientName": "Math 8th Class 2024"
    }
  ],
  "modes": [
    {
      "modeType": "SYSTEM_ALERT",
      "settings": {
        "priority": "HIGH"
      }
    },
    {
      "modeType": "DASHBOARD_PIN",
      "settings": {
        "durationHours": 24,
        "priority": "HIGH"
      }
    }
  ],
  "mediums": [
    {
      "mediumType": "PUSH_NOTIFICATION",
      "config": {
        "title": "Assignment Reminder",
        "body": "Math assignment due tomorrow"
      }
    },
    {
      "mediumType": "EMAIL",
      "config": {
        "subject": "Assignment Due Reminder",
        "template": "assignment_reminder"
      }
    }
  ],
  "scheduling": {
    "scheduleType": "ONE_TIME",
    "startDate": "2024-01-15T09:00:00",
    "timezone": "Asia/Kolkata"
  }
}
```

**Response:**
```json
{
  "id": "announcement_789",
  "title": "Assignment Due Tomorrow",
  "status": "ACTIVE",
  "createdAt": "2024-01-15T08:30:00",
  "recipientCount": 45,
  "deliveryStatus": {
    "total": 45,
    "delivered": 0,
    "pending": 45,
    "failed": 0
  }
}
```

### 2. Get User Messages
Retrieve messages for a specific user with mode-specific filtering.

**Endpoint:** `GET /user-messages/user/{userId}`

**Query Parameters:**
- `modeType` (optional): Filter by mode (SYSTEM_ALERT, DASHBOARD_PIN, etc.)
- `page` (default: 0): Page number
- `size` (default: 20): Page size

**Example:**
```
GET /user-messages/user/user_123?modeType=SYSTEM_ALERT&page=0&size=10
```

### 3. Mode-Specific Message Retrieval

#### Dashboard Pins
```
GET /user-messages/user/{userId}/dashboard-pins
```

#### Resource Messages
```
GET /user-messages/user/{userId}/resources?folderName=Math&category=Homework
```

#### Community Messages
```
GET /user-messages/user/{userId}/community?communityType=DISCUSSION&tag=physics
```

#### Stream Messages
```
GET /user-messages/user/{userId}/streams/{packageSessionId}?streamType=LIVE_CLASS
```

## Recipient Types

### 1. ROLE-based Recipients
Target users by their role in the institute:
```json
{
  "recipientType": "ROLE",
  "recipientId": "STUDENT:institute_123",
  "recipientName": "All Students"
}
```

### 2. PACKAGE_SESSION Recipients
Target users in specific package sessions (classes/batches):
```json
{
  "recipientType": "PACKAGE_SESSION", 
  "recipientId": "math_8th_2024",
  "recipientName": "Math 8th Class 2024"
}
```

### 3. Individual USER Recipients
Target specific users:
```json
{
  "recipientType": "USER",
  "recipientId": "user_456",
  "recipientName": "John Smith"
}
```

## Mode Types & Settings

### SYSTEM_ALERT
Bell icon notifications in UI:
```json
{
  "modeType": "SYSTEM_ALERT",
  "settings": {
    "priority": "HIGH|MEDIUM|LOW"
  }
}
```

### DASHBOARD_PIN
Pinned messages on dashboard:
```json
{
  "modeType": "DASHBOARD_PIN", 
  "settings": {
    "durationHours": 24,
    "priority": "HIGH",
    "position": "TOP"
  }
}
```

### RESOURCES
Messages in resources tab:
```json
{
  "modeType": "RESOURCES",
  "settings": {
    "folderName": "Math",
    "category": "Homework",
    "accessLevel": "STUDENT"
  }
}
```

### COMMUNITY
Community/discussion posts:
```json
{
  "modeType": "COMMUNITY",
  "settings": {
    "communityType": "DISCUSSION",
    "tags": ["physics", "assignment"],
    "allowReplies": true
  }
}
```

### STREAM
Live session/stream messages:
```json
{
  "modeType": "STREAM",
  "settings": {
    "streamType": "LIVE_CLASS",
    "packageSessionId": "math_8th_2024"
  }
}
```

### DM (Direct Message)
Private messages to users:
```json
{
  "modeType": "DM",
  "settings": {
    "priority": "HIGH",
    "allowReplies": true
  }
}
```

## Medium Types & Configuration

### PUSH_NOTIFICATION
Firebase Cloud Messaging:
```json
{
  "mediumType": "PUSH_NOTIFICATION",
  "config": {
    "title": "Notification Title",
    "body": "Notification body text",
    "data": {
      "action": "open_assignment",
      "assignmentId": "123"
    }
  }
}
```

### EMAIL
Email delivery:
```json
{
  "mediumType": "EMAIL",
  "config": {
    "subject": "Email Subject",
    "template": "assignment_reminder",
    "attachments": ["file1.pdf"]
  }
}
```

### WHATSAPP
WhatsApp Business API:
```json
{
  "mediumType": "WHATSAPP",
  "config": {
    "templateName": "assignment_reminder",
    "dynamicValues": {
      "1": "Math Assignment",
      "2": "Tomorrow 5 PM"
    }
  }
}
```

## Scheduling Options

### One-time Delivery
```json
{
  "scheduleType": "ONE_TIME",
  "startDate": "2024-01-15T09:00:00",
  "timezone": "Asia/Kolkata"
}
```

### Recurring Delivery
```json
{
  "scheduleType": "RECURRING",
  "cronExpression": "0 9 * * MON",
  "startDate": "2024-01-15T09:00:00",
  "endDate": "2024-06-15T09:00:00",
  "timezone": "Asia/Kolkata"
}
```

## User Interactions

### Mark as Read
```json
POST /user-messages/interactions/read
{
  "recipientMessageId": "msg_123",
  "userId": "user_456",
  "interactionType": "READ"
}
```

### Dismiss Message
```json
POST /user-messages/interactions/dismiss
{
  "recipientMessageId": "msg_123", 
  "userId": "user_456",
  "interactionType": "DISMISSED"
}
```

### Reply to Message
```json
POST /message-replies
{
  "announcementId": "announcement_789",
  "parentMessageId": null,
  "userId": "user_456",
  "userName": "John Smith",
  "userRole": "STUDENT",
  "content": {
    "type": "text",
    "content": "Thanks for the reminder!"
  }
}
```

## Error Handling

### Standard Error Response
```json
{
  "timestamp": "2024-01-15T10:30:00",
  "status": 400,
  "error": "Validation Failed",
  "message": "Request validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "title": "Title is required",
    "recipients": "At least one recipient is required"
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Input validation failed
- `ANNOUNCEMENT_NOT_FOUND`: Announcement doesn't exist
- `USER_RESOLUTION_ERROR`: Failed to resolve recipients
- `CREATION_ERROR`: Failed to create announcement
- `INTERNAL_ERROR`: Unexpected server error

## Integration Examples

### From Assessment Service
```javascript
// When assignment is created
const announcement = {
  title: `New Assignment: ${assignment.title}`,
  content: {
    type: "html", 
    content: `<p>New assignment <strong>${assignment.title}</strong> has been posted.</p>`
  },
  instituteId: assignment.instituteId,
  createdBy: teacher.id,
  createdByName: teacher.name,
  createdByRole: "TEACHER",
  recipients: [{
    recipientType: "PACKAGE_SESSION",
    recipientId: assignment.packageSessionId
  }],
  modes: [{
    modeType: "SYSTEM_ALERT",
    settings: { priority: "HIGH" }
  }],
  mediums: [{
    mediumType: "PUSH_NOTIFICATION",
    config: {
      title: "New Assignment",
      body: assignment.title
    }
  }]
};

fetch('http://notification-service:8076/notification-service/v1/announcements', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(announcement)
});
```

### From Admin Core Service
```javascript
// When live session starts
const announcement = {
  title: "Live Class Starting",
  content: {
    type: "text",
    content: "Your Math class is starting in 5 minutes. Join now!"
  },
  instituteId: session.instituteId,
  createdBy: "system",
  createdByName: "System",
  createdByRole: "SYSTEM",
  recipients: [{
    recipientType: "PACKAGE_SESSION",
    recipientId: session.packageSessionId
  }],
  modes: [{
    modeType: "STREAM",
    settings: {
      streamType: "LIVE_CLASS",
      packageSessionId: session.packageSessionId
    }
  }],
  mediums: [{
    mediumType: "PUSH_NOTIFICATION",
    config: {
      title: "Class Starting",
      body: "Join your live class now",
      data: { sessionId: session.id }
    }
  }]
};
```

## Best Practices

1. **Always provide complete user context** (createdBy, createdByName, createdByRole)
2. **Use appropriate mode types** for different UI components
3. **Set realistic delivery schedules** considering user timezones
4. **Include relevant medium configurations** for better user experience
5. **Use descriptive titles and content** for better engagement
6. **Test with small recipient groups** before mass announcements
7. **Monitor delivery status** for important announcements
8. **Handle errors gracefully** in your service integration

## Support

For integration support or questions about the announcement system, refer to the service documentation or contact the platform team.