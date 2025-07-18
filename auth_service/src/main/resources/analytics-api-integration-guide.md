# User Activity Analytics Integration Guide

## Overview
The auth service now includes comprehensive user activity tracking and analytics capabilities. This guide explains how to integrate with these features.

## Activity Tracking Integration

### 1. Updated getUserDetails API

The `/auth-service/v1/internal/user` endpoint now accepts additional parameters for activity tracking:

```
GET /auth-service/v1/internal/user?userName={userName}&serviceName={serviceName}&sessionToken={sessionToken}
```

**Parameters:**
- `userName` (required): Username to authenticate
- `serviceName` (optional): Name of the calling service (e.g., "admin-core-service", "assessment-service")
- `sessionToken` (optional): User's session token for session tracking

### 2. Service Integration Examples

#### For Java Services (Spring Boot)

Update your `UserDetailsServiceImpl` to include service name and session token:

```java
@Component
@Slf4j
public class UserDetailsServiceImpl implements UserDetailsService {
    
    @Value("${spring.application.name}")
    String clientName;
    
    @Value("${auth.server.baseurl}")
    String authServerBaseUrl;
    
    @Autowired
    private InternalClientUtils internalClientUtils;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        
        // Extract session token from SecurityContext if available
        String sessionToken = extractSessionToken();
        
        String endpoint = AuthConstant.userServiceRoute 
            + "?userName=" + username 
            + "&serviceName=" + clientName
            + (sessionToken != null ? "&sessionToken=" + sessionToken : "");
            
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.GET.name(),
                authServerBaseUrl,
                endpoint,
                null);

        ObjectMapper objectMapper = new ObjectMapper();

        try {
            UserServiceDTO customUserDetails = objectMapper.readValue(response.getBody(), UserServiceDTO.class);
            log.info("User Authenticated Successfully..!!!");
            return new CustomUserDetails(customUserDetails);
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }
    
    private String extractSessionToken() {
        // Extract from JWT token, session, or request context
        // Implementation depends on your session management
        return SecurityContextHolder.getContext().getAuthentication().getCredentials().toString();
    }
}
```

## Analytics APIs

### 1. Get Comprehensive Analytics

```
GET /auth-service/v1/analytics/user-activity?instituteId={instituteId}
```

Returns complete analytics including:
- Real-time active users
- Daily activity summaries
- Service usage statistics
- Device usage patterns
- Most active users
- Engagement trends

### 2. Real-time Active Users

```
GET /auth-service/v1/analytics/active-users/real-time?instituteId={instituteId}
```

Returns current count of active users.

### 3. Active Users by Time Range

```
GET /auth-service/v1/analytics/active-users?instituteId={instituteId}
```

Returns:
```json
{
  "currently_active": 25,
  "last_5_minutes": 30,
  "last_hour": 45,
  "last_24_hours": 120
}
```

### 4. Today's Activity Summary

```
GET /auth-service/v1/analytics/activity/today?instituteId={instituteId}
```

Returns:
```json
{
  "unique_active_users": 85,
  "total_sessions": 120,
  "total_api_calls": 2450,
  "total_activity_time_minutes": 3600,
  "average_session_duration_minutes": 30.5,
  "peak_activity_hour": 14
}
```

### 5. Service Usage Statistics

```
GET /auth-service/v1/analytics/service-usage?instituteId={instituteId}
```

Returns service usage data and most used services.

### 6. Engagement Trends

```
GET /auth-service/v1/analytics/engagement/trends?instituteId={instituteId}
```

Returns daily trends, device usage, and hourly activity patterns.

### 7. Most Active Users

```
GET /auth-service/v1/analytics/users/most-active?instituteId={instituteId}&limit=10
```

Returns top active users with their activity metrics.

## Database Schema

### New Tables Created

1. **user_activity_log** - Detailed activity tracking
2. **user_session** - Session management and tracking  
3. **daily_user_activity_summary** - Aggregated daily statistics

### Key Features

- **Asynchronous Logging**: Activity logging doesn't impact API performance
- **Session Tracking**: Real-time session management
- **Daily Aggregation**: Efficient querying through pre-computed summaries
- **Automatic Cleanup**: Old logs are automatically purged
- **Real-time Analytics**: Live activity monitoring

## Admin Dashboard Integration

### Sample Dashboard Components

1. **Real-time Metrics Card**
   - Currently active users
   - Users active in last hour
   - Today's session count

2. **Activity Trends Chart**
   - 7-day activity trend
   - Peak usage hours
   - Service adoption rates

3. **User Engagement Table**
   - Most active users
   - Session duration averages
   - Device type distribution

4. **Service Performance**
   - API response times
   - Error rates by service
   - Usage patterns

### Enhanced Analytics Response with User Details

The enhanced analytics now include complete user information (username, full name, email) wherever user IDs were previously shown:

```json
{
  "currently_active_users": 25,
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
      "session_duration_minutes": 295
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
      "frequent_services": ["assessment-service", "admin-core-service"],
      "preferred_device_type": "desktop"
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
    }
  ]
}
```

### 8. Currently Active Users with Details

```
GET /auth-service/v1/analytics/users/currently-active?instituteId={instituteId}
```

Returns detailed information about all currently active users:

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
    }
  ]
}
```

### Sample React Component with Enhanced User Details

```javascript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const UserActivityDashboard = ({ instituteId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [activeUsers, setActiveUsers] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [analyticsRes, activeUsersRes] = await Promise.all([
          fetch(`/auth-service/v1/analytics/user-activity?instituteId=${instituteId}`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
          }),
          fetch(`/auth-service/v1/analytics/users/currently-active?instituteId=${instituteId}`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
          })
        ]);
        
        const analyticsData = await analyticsRes.json();
        const activeUsersData = await activeUsersRes.json();
        
        setAnalytics(analyticsData);
        setActiveUsers(activeUsersData);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, [instituteId]);

  if (loading) return <div>Loading analytics...</div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Currently Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {analytics.currently_active_users}
            </div>
            <p className="text-sm text-gray-600">users online now</p>
          </CardContent>
        </Card>
        {/* Other cards... */}
      </div>

      {/* Currently Active Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Currently Active Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Current Service</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Session Duration</TableHead>
                <TableHead>Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeUsers?.active_users_list?.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-gray-500">@{user.username}</div>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                      {user.current_service}
                    </span>
                  </TableCell>
                  <TableCell>{user.device_type}</TableCell>
                  <TableCell>{user.session_duration_minutes}m</TableCell>
                  <TableCell>
                    {new Date(user.last_activity).toLocaleTimeString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Most Active Users */}
      <Card>
        <CardHeader>
          <CardTitle>Most Active Users (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Time Active</TableHead>
                <TableHead>API Calls</TableHead>
                <TableHead>Frequent Services</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics?.most_active_users?.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      user.current_status === 'ONLINE' ? 'bg-green-100 text-green-800' :
                      user.current_status === 'RECENTLY_ACTIVE' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.current_status}
                    </span>
                  </TableCell>
                  <TableCell>{user.total_sessions}</TableCell>
                  <TableCell>{Math.round(user.total_activity_time_minutes / 60)}h</TableCell>
                  <TableCell>{user.total_api_calls}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.frequent_services?.slice(0, 2).map((service) => (
                        <span key={service} className="px-1 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                          {service}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserActivityDashboard;
```

## Performance Considerations

1. **Asynchronous Processing**: All activity logging is asynchronous
2. **Efficient Queries**: Use aggregated summaries for historical data
3. **Caching**: Consider Redis caching for real-time metrics
4. **Batch Processing**: Daily aggregation runs during off-peak hours
5. **Data Retention**: Old logs are automatically cleaned up

## Security and Privacy

1. **Data Anonymization**: Personal data can be excluded from logs
2. **Access Control**: Analytics APIs require proper authentication
3. **Audit Trail**: All analytics access is logged
4. **Compliance**: Data retention policies can be configured

## Monitoring and Alerts

Set up alerts for:
- Sudden drop in active users
- High API response times
- Failed authentication attempts
- Unusual activity patterns

This analytics system provides comprehensive insights into user behavior while maintaining performance and security standards. 