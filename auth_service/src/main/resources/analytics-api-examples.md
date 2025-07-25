# User Activity Analytics API Examples

## Overview
This document provides comprehensive curl examples and expected responses for all user activity analytics APIs.

## Authentication
All API calls require a valid JWT token in the Authorization header:
```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## API Endpoints and Examples

### 1. Get Comprehensive User Activity Analytics

**Endpoint:** `GET /auth-service/v1/analytics/user-activity`

**Curl:**
```bash
curl -X GET "https://api.yourdomain.com/auth-service/v1/analytics/user-activity?instituteId=inst_12345" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "currently_active_users": 25,
  "active_users_last5_minutes": 30,
  "active_users_last_hour": 45,
  "active_users_last24_hours": 120,
  "today_total_sessions": 156,
  "today_total_api_calls": 2450,
  "today_total_activity_time_minutes": 3600,
  "today_unique_active_users": 85,
  "average_session_duration_minutes": 30.5,
  "peak_activity_hour": 14,
  "most_used_services": [
    "assessment-service",
    "admin-core-service", 
    "media-service",
    "community-service"
  ],
  "currently_active_users_list": [
    {
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "username": "john.doe",
      "full_name": "John Doe",
      "email": "john.doe@institute.edu",
      "login_time": "2024-01-15T09:30:00",
      "last_activity": "2024-01-15T14:25:00",
      "current_service": "assessment-service",
      "device_type": "desktop",
      "ip_address": "192.168.1.100",
      "session_duration_minutes": 295
    },
    {
      "user_id": "456e7890-e89b-12d3-a456-426614174001",
      "username": "sarah.smith",
      "full_name": "Sarah Smith",
      "email": "sarah.smith@institute.edu",
      "login_time": "2024-01-15T10:15:00",
      "last_activity": "2024-01-15T14:20:00",
      "current_service": "media-service",
      "device_type": "mobile",
      "ip_address": "192.168.1.101",
      "session_duration_minutes": 245
    }
  ],
  "daily_activity_trend": [
    {
      "date": "2024-01-09",
      "unique_users": 78,
      "total_sessions": 120,
      "total_api_calls": 1890,
      "average_session_duration": 28.5
    },
    {
      "date": "2024-01-10",
      "unique_users": 82,
      "total_sessions": 135,
      "total_api_calls": 2100,
      "average_session_duration": 32.1
    },
    {
      "date": "2024-01-11",
      "unique_users": 90,
      "total_sessions": 145,
      "total_api_calls": 2350,
      "average_session_duration": 29.8
    }
  ],
  "service_usage_stats": [
    {
      "service_name": "assessment-service",
      "usage_count": 1250,
      "average_response_time": 125.5,
      "unique_users": 45,
      "top_users": [
        {
          "user_id": "123e4567-e89b-12d3-a456-426614174000",
          "username": "john.doe",
          "full_name": "John Doe",
          "email": "john.doe@institute.edu",
          "usage_count": 85,
          "last_used": "2024-01-15T14:25:00"
        },
        {
          "user_id": "456e7890-e89b-12d3-a456-426614174001",
          "username": "sarah.smith",
          "full_name": "Sarah Smith",
          "email": "sarah.smith@institute.edu",
          "usage_count": 67,
          "last_used": "2024-01-15T13:45:00"
        }
      ]
    },
    {
      "service_name": "admin-core-service",
      "usage_count": 890,
      "average_response_time": 89.2,
      "unique_users": 23,
      "top_users": [
        {
          "user_id": "789e0123-e89b-12d3-a456-426614174002",
          "username": "admin.user",
          "full_name": "Admin User",
          "email": "admin@institute.edu",
          "usage_count": 156,
          "last_used": "2024-01-15T14:30:00"
        }
      ]
    }
  ],
  "device_usage_stats": [
    {
      "device_type": "desktop",
      "usage_count": 2100,
      "unique_users": 67,
      "top_users": [
        {
          "user_id": "123e4567-e89b-12d3-a456-426614174000",
          "username": "john.doe",
          "full_name": "John Doe",
          "email": "john.doe@institute.edu",
          "usage_count": 95,
          "last_used": "2024-01-15T14:25:00"
        }
      ]
    },
    {
      "device_type": "mobile",
      "usage_count": 1560,
      "unique_users": 89,
      "top_users": [
        {
          "user_id": "456e7890-e89b-12d3-a456-426614174001",
          "username": "sarah.smith",
          "full_name": "Sarah Smith",
          "email": "sarah.smith@institute.edu",
          "usage_count": 78,
          "last_used": "2024-01-15T14:20:00"
        }
      ]
    }
  ],
  "most_active_users": [
    {
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "username": "john.doe",
      "full_name": "John Doe",
      "email": "john.doe@institute.edu",
      "total_sessions": 15,
      "total_activity_time_minutes": 450,
      "total_api_calls": 1250,
      "last_activity": "2024-01-15T14:25:00",
      "current_status": "ONLINE",
      "frequent_services": [
        "assessment-service",
        "admin-core-service",
        "media-service"
      ],
      "preferred_device_type": "desktop"
    },
    {
      "user_id": "456e7890-e89b-12d3-a456-426614174001",
      "username": "sarah.smith",
      "full_name": "Sarah Smith",
      "email": "sarah.smith@institute.edu",
      "total_sessions": 12,
      "total_activity_time_minutes": 380,
      "total_api_calls": 980,
      "last_activity": "2024-01-15T14:20:00",
      "current_status": "ONLINE",
      "frequent_services": [
        "media-service",
        "community-service"
      ],
      "preferred_device_type": "mobile"
    }
  ],
  "hourly_activity": [
    {
      "hour": 9,
      "activity_count": 145,
      "unique_users": 23,
      "top_active_users": [
        {
          "user_id": "123e4567-e89b-12d3-a456-426614174000",
          "username": "john.doe",
          "full_name": "John Doe",
          "email": "john.doe@institute.edu",
          "activity_count": 25
        }
      ]
    },
    {
      "hour": 14,
      "activity_count": 267,
      "unique_users": 45,
      "top_active_users": [
        {
          "user_id": "456e7890-e89b-12d3-a456-426614174001",
          "username": "sarah.smith",
          "full_name": "Sarah Smith",
          "email": "sarah.smith@institute.edu",
          "activity_count": 38
        }
      ]
    }
  ]
}
```

### 2. Get Real-Time Active Users Count

**Endpoint:** `GET /auth-service/v1/analytics/active-users/real-time`

**Curl:**
```bash
curl -X GET "https://api.yourdomain.com/auth-service/v1/analytics/active-users/real-time?instituteId=inst_12345" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response:**
```json
25
```

### 3. Get Active Users by Time Range

**Endpoint:** `GET /auth-service/v1/analytics/active-users`

**Curl:**
```bash
curl -X GET "https://api.yourdomain.com/auth-service/v1/analytics/active-users?instituteId=inst_12345" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "currently_active": 25,
  "last_5_minutes": 30,
  "last_hour": 45,
  "last_24_hours": 120
}
```

### 4. Get Today's Activity Summary

**Endpoint:** `GET /auth-service/v1/analytics/activity/today`

**Curl:**
```bash
curl -X GET "https://api.yourdomain.com/auth-service/v1/analytics/activity/today?instituteId=inst_12345" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "unique_active_users": 85,
  "total_sessions": 156,
  "total_api_calls": 2450,
  "total_activity_time_minutes": 3600,
  "average_session_duration_minutes": 30.5,
  "peak_activity_hour": 14
}
```

### 5. Get Service Usage Statistics

**Endpoint:** `GET /auth-service/v1/analytics/service-usage`

**Curl:**
```bash
curl -X GET "https://api.yourdomain.com/auth-service/v1/analytics/service-usage?instituteId=inst_12345" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "most_used_services": [
    "assessment-service",
    "admin-core-service",
    "media-service",
    "community-service",
    "notification-service"
  ],
  "service_usage_stats": [
    {
      "service_name": "assessment-service",
      "usage_count": 1250,
      "average_response_time": 125.5,
      "unique_users": 45,
      "top_users": [
        {
          "user_id": "123e4567-e89b-12d3-a456-426614174000",
          "username": "john.doe",
          "full_name": "John Doe",
          "email": "john.doe@institute.edu",
          "usage_count": 85,
          "last_used": "2024-01-15T14:25:00"
        },
        {
          "user_id": "456e7890-e89b-12d3-a456-426614174001",
          "username": "sarah.smith",
          "full_name": "Sarah Smith",
          "email": "sarah.smith@institute.edu",
          "usage_count": 67,
          "last_used": "2024-01-15T13:45:00"
        },
        {
          "user_id": "789e0123-e89b-12d3-a456-426614174002",
          "username": "mike.johnson",
          "full_name": "Mike Johnson",
          "email": "mike.johnson@institute.edu",
          "usage_count": 52,
          "last_used": "2024-01-15T12:30:00"
        }
      ]
    },
    {
      "service_name": "admin-core-service",
      "usage_count": 890,
      "average_response_time": 89.2,
      "unique_users": 23,
      "top_users": [
        {
          "user_id": "789e0123-e89b-12d3-a456-426614174002",
          "username": "admin.user",
          "full_name": "Admin User",
          "email": "admin@institute.edu",
          "usage_count": 156,
          "last_used": "2024-01-15T14:30:00"
        }
      ]
    },
    {
      "service_name": "media-service",
      "usage_count": 2100,
      "average_response_time": 234.7,
      "unique_users": 67,
      "top_users": [
        {
          "user_id": "456e7890-e89b-12d3-a456-426614174001",
          "username": "sarah.smith",
          "full_name": "Sarah Smith",
          "email": "sarah.smith@institute.edu",
          "usage_count": 92,
          "last_used": "2024-01-15T14:20:00"
        }
      ]
    }
  ]
}
```

### 6. Get Engagement Trends

**Endpoint:** `GET /auth-service/v1/analytics/engagement/trends`

**Curl:**
```bash
curl -X GET "https://api.yourdomain.com/auth-service/v1/analytics/engagement/trends?instituteId=inst_12345" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "daily_activity_trend": [
    {
      "date": "2024-01-09",
      "unique_users": 78,
      "total_sessions": 120,
      "total_api_calls": 1890,
      "average_session_duration": 28.5
    },
    {
      "date": "2024-01-10",
      "unique_users": 82,
      "total_sessions": 135,
      "total_api_calls": 2100,
      "average_session_duration": 32.1
    },
    {
      "date": "2024-01-11",
      "unique_users": 90,
      "total_sessions": 145,
      "total_api_calls": 2350,
      "average_session_duration": 29.8
    },
    {
      "date": "2024-01-12",
      "unique_users": 88,
      "total_sessions": 142,
      "total_api_calls": 2280,
      "average_session_duration": 31.2
    },
    {
      "date": "2024-01-13",
      "unique_users": 95,
      "total_sessions": 158,
      "total_api_calls": 2520,
      "average_session_duration": 33.4
    },
    {
      "date": "2024-01-14",
      "unique_users": 92,
      "total_sessions": 151,
      "total_api_calls": 2410,
      "average_session_duration": 30.8
    },
    {
      "date": "2024-01-15",
      "unique_users": 85,
      "total_sessions": 156,
      "total_api_calls": 2450,
      "average_session_duration": 30.5
    }
  ],
  "device_usage_stats": [
    {
      "device_type": "desktop",
      "usage_count": 2100,
      "unique_users": 67,
      "top_users": [
        {
          "user_id": "123e4567-e89b-12d3-a456-426614174000",
          "username": "john.doe",
          "full_name": "John Doe",
          "email": "john.doe@institute.edu",
          "usage_count": 95,
          "last_used": "2024-01-15T14:25:00"
        }
      ]
    },
    {
      "device_type": "mobile",
      "usage_count": 1560,
      "unique_users": 89,
      "top_users": [
        {
          "user_id": "456e7890-e89b-12d3-a456-426614174001",
          "username": "sarah.smith",
          "full_name": "Sarah Smith",
          "email": "sarah.smith@institute.edu",
          "usage_count": 78,
          "last_used": "2024-01-15T14:20:00"
        }
      ]
    },
    {
      "device_type": "tablet",
      "usage_count": 890,
      "unique_users": 34,
      "top_users": [
        {
          "user_id": "789e0123-e89b-12d3-a456-426614174002",
          "username": "lisa.brown",
          "full_name": "Lisa Brown",
          "email": "lisa.brown@institute.edu",
          "usage_count": 45,
          "last_used": "2024-01-15T13:15:00"
        }
      ]
    }
  ],
  "hourly_activity": [
    {
      "hour": 8,
      "activity_count": 89,
      "unique_users": 15,
      "top_active_users": [
        {
          "user_id": "789e0123-e89b-12d3-a456-426614174002",
          "username": "admin.user",
          "full_name": "Admin User",
          "email": "admin@institute.edu",
          "activity_count": 12
        }
      ]
    },
    {
      "hour": 9,
      "activity_count": 145,
      "unique_users": 23,
      "top_active_users": [
        {
          "user_id": "123e4567-e89b-12d3-a456-426614174000",
          "username": "john.doe",
          "full_name": "John Doe",
          "email": "john.doe@institute.edu",
          "activity_count": 25
        }
      ]
    },
    {
      "hour": 10,
      "activity_count": 178,
      "unique_users": 28,
      "top_active_users": [
        {
          "user_id": "456e7890-e89b-12d3-a456-426614174001",
          "username": "sarah.smith",
          "full_name": "Sarah Smith",
          "email": "sarah.smith@institute.edu",
          "activity_count": 31
        }
      ]
    },
    {
      "hour": 14,
      "activity_count": 267,
      "unique_users": 45,
      "top_active_users": [
        {
          "user_id": "456e7890-e89b-12d3-a456-426614174001",
          "username": "sarah.smith",
          "full_name": "Sarah Smith",
          "email": "sarah.smith@institute.edu",
          "activity_count": 38
        }
      ]
    }
  ]
}
```

### 7. Get Most Active Users

**Endpoint:** `GET /auth-service/v1/analytics/users/most-active`

**Curl:**
```bash
curl -X GET "https://api.yourdomain.com/auth-service/v1/analytics/users/most-active?instituteId=inst_12345&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "most_active_users": [
    {
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "username": "john.doe",
      "full_name": "John Doe",
      "email": "john.doe@institute.edu",
      "total_sessions": 15,
      "total_activity_time_minutes": 450,
      "total_api_calls": 1250,
      "last_activity": "2024-01-15T14:25:00",
      "current_status": "ONLINE",
      "frequent_services": [
        "assessment-service",
        "admin-core-service",
        "media-service"
      ],
      "preferred_device_type": "desktop"
    },
    {
      "user_id": "456e7890-e89b-12d3-a456-426614174001",
      "username": "sarah.smith",
      "full_name": "Sarah Smith",
      "email": "sarah.smith@institute.edu",
      "total_sessions": 12,
      "total_activity_time_minutes": 380,
      "total_api_calls": 980,
      "last_activity": "2024-01-15T14:20:00",
      "current_status": "ONLINE",
      "frequent_services": [
        "media-service",
        "community-service"
      ],
      "preferred_device_type": "mobile"
    },
    {
      "user_id": "789e0123-e89b-12d3-a456-426614174002",
      "username": "mike.johnson",
      "full_name": "Mike Johnson",
      "email": "mike.johnson@institute.edu",
      "total_sessions": 10,
      "total_activity_time_minutes": 320,
      "total_api_calls": 850,
      "last_activity": "2024-01-15T13:45:00",
      "current_status": "RECENTLY_ACTIVE",
      "frequent_services": [
        "assessment-service",
        "community-service"
      ],
      "preferred_device_type": "desktop"
    },
    {
      "user_id": "abc1234d-e89b-12d3-a456-426614174003",
      "username": "lisa.brown",
      "full_name": "Lisa Brown",
      "email": "lisa.brown@institute.edu",
      "total_sessions": 8,
      "total_activity_time_minutes": 290,
      "total_api_calls": 720,
      "last_activity": "2024-01-15T12:30:00",
      "current_status": "OFFLINE",
      "frequent_services": [
        "media-service",
        "notification-service"
      ],
      "preferred_device_type": "tablet"
    },
    {
      "user_id": "def5678e-e89b-12d3-a456-426614174004",
      "username": "admin.user",
      "full_name": "Admin User",
      "email": "admin@institute.edu",
      "total_sessions": 7,
      "total_activity_time_minutes": 280,
      "total_api_calls": 920,
      "last_activity": "2024-01-15T14:30:00",
      "current_status": "ONLINE",
      "frequent_services": [
        "admin-core-service",
        "assessment-service"
      ],
      "preferred_device_type": "desktop"
    }
  ]
}
```

### 8. Get Currently Active Users with Details

**Endpoint:** `GET /auth-service/v1/analytics/users/currently-active`

**Curl:**
```bash
curl -X GET "https://api.yourdomain.com/auth-service/v1/analytics/users/currently-active?instituteId=inst_12345" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "total_active_users": 25,
  "active_users_list": [
    {
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "username": "john.doe",
      "full_name": "John Doe",
      "email": "john.doe@institute.edu",
      "login_time": "2024-01-15T09:30:00",
      "last_activity": "2024-01-15T14:25:00",
      "current_service": "assessment-service",
      "device_type": "desktop",
      "ip_address": "192.168.1.100",
      "session_duration_minutes": 295
    },
    {
      "user_id": "456e7890-e89b-12d3-a456-426614174001",
      "username": "sarah.smith",
      "full_name": "Sarah Smith",
      "email": "sarah.smith@institute.edu",
      "login_time": "2024-01-15T10:15:00",
      "last_activity": "2024-01-15T14:20:00",
      "current_service": "media-service",
      "device_type": "mobile",
      "ip_address": "192.168.1.101",
      "session_duration_minutes": 245
    },
    {
      "user_id": "789e0123-e89b-12d3-a456-426614174002",
      "username": "mike.johnson",
      "full_name": "Mike Johnson",
      "email": "mike.johnson@institute.edu",
      "login_time": "2024-01-15T11:45:00",
      "last_activity": "2024-01-15T14:18:00",
      "current_service": "community-service",
      "device_type": "desktop",
      "ip_address": "192.168.1.102",
      "session_duration_minutes": 153
    },
    {
      "user_id": "abc1234d-e89b-12d3-a456-426614174003",
      "username": "lisa.brown",
      "full_name": "Lisa Brown",
      "email": "lisa.brown@institute.edu",
      "login_time": "2024-01-15T13:00:00",
      "last_activity": "2024-01-15T14:15:00",
      "current_service": "admin-core-service",
      "device_type": "tablet",
      "ip_address": "192.168.1.103",
      "session_duration_minutes": 75
    },
    {
      "user_id": "def5678e-e89b-12d3-a456-426614174004",
      "username": "admin.user",
      "full_name": "Admin User",
      "email": "admin@institute.edu",
      "login_time": "2024-01-15T08:00:00",
      "last_activity": "2024-01-15T14:30:00",
      "current_service": "admin-core-service",
      "device_type": "desktop",
      "ip_address": "192.168.1.104",
      "session_duration_minutes": 390
    }
  ]
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "status": 401,
  "timestamp": "2024-01-15T14:30:00Z"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions to access analytics for this institute",
  "status": 403,
  "timestamp": "2024-01-15T14:30:00Z"
}
```

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Missing required parameter: instituteId",
  "status": 400,
  "timestamp": "2024-01-15T14:30:00Z"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Analytics service temporarily unavailable",
  "status": 500,
  "timestamp": "2024-01-15T14:30:00Z"
}
```

## Rate Limiting

All analytics APIs are rate-limited to prevent abuse:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642252800
```

**Rate Limits:**
- **General analytics endpoints**: 100 requests per hour per user
- **Real-time endpoints**: 200 requests per hour per user
- **Bulk data endpoints**: 50 requests per hour per user

## Best Practices

### 1. Caching
```bash
# Add cache headers for better performance
curl -X GET "https://api.yourdomain.com/auth-service/v1/analytics/user-activity?instituteId=inst_12345" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Cache-Control: max-age=300" \
  -H "Content-Type: application/json"
```

### 2. Pagination for Large Datasets
```bash
# For endpoints that support pagination
curl -X GET "https://api.yourdomain.com/auth-service/v1/analytics/users/most-active?instituteId=inst_12345&limit=50&offset=0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

### 3. Time Range Filtering
```bash
# For endpoints that support date filtering
curl -X GET "https://api.yourdomain.com/auth-service/v1/analytics/engagement/trends?instituteId=inst_12345&startDate=2024-01-01&endDate=2024-01-15" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

## Integration Examples

### JavaScript/React
```javascript
const fetchAnalytics = async (instituteId, token) => {
  try {
    const response = await fetch(
      `https://api.yourdomain.com/auth-service/v1/analytics/user-activity?instituteId=${instituteId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const analytics = await response.json();
    return analytics;
  } catch (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }
};
```

### Python
```python
import requests

def get_analytics(institute_id, token):
    url = f"https://api.yourdomain.com/auth-service/v1/analytics/user-activity"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    params = {'instituteId': institute_id}
    
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching analytics: {e}")
        raise
```

### Java
```java
public class AnalyticsClient {
    private final String baseUrl = "https://api.yourdomain.com";
    private final RestTemplate restTemplate = new RestTemplate();
    
    public UserActivityAnalyticsDto getAnalytics(String instituteId, String token) {
        String url = baseUrl + "/auth-service/v1/analytics/user-activity?instituteId=" + instituteId;
        
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        HttpEntity<String> entity = new HttpEntity<>(headers);
        
        ResponseEntity<UserActivityAnalyticsDto> response = restTemplate.exchange(
            url, HttpMethod.GET, entity, UserActivityAnalyticsDto.class);
            
        return response.getBody();
    }
}
```

This comprehensive API documentation provides everything needed to integrate with the user activity analytics system! 