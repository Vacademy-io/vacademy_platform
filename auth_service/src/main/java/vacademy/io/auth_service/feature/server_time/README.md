# Server Time API

An optimized REST API for retrieving server time with comprehensive timezone support.

## Endpoints

### 1. Get UTC Time (Fastest)
```
GET /auth-service/v1/server-time/utc
```
Returns current server time in UTC. Optimized for high-frequency polling.

### 2. Get Time with Timezone
```
GET /auth-service/v1/server-time?timezone={timezone_id}
```
Returns current server time in the specified timezone.

**Parameters:**
- `timezone` (optional): Timezone identifier (e.g., "America/New_York", "Asia/Kolkata"). Defaults to "UTC".

### 3. Get System Default Time
```
GET /auth-service/v1/server-time/system
```
Returns current server time in the system's default timezone.

### 4. Validate Timezone
```
GET /auth-service/v1/server-time/validate-timezone?timezone={timezone_id}
```
Validates if a timezone identifier is supported.

### 5. Get Available Timezones
```
GET /auth-service/v1/server-time/timezones
```
Returns all available timezone identifiers. Cached for 24 hours.

### 6. Health Check
```
GET /auth-service/v1/server-time/health
```
Simple health check endpoint.

## Response Format

```json
{
  "timestamp": 1696723200000,
  "iso_string": "2023-10-08T00:00:00Z",
  "timezone": "UTC",
  "timezone_offset": "Z",
  "utc_timestamp": 1696723200000,
  "utc_iso_string": "2023-10-08T00:00:00Z",
  "formatted_time": "2023-10-08T00:00:00",
  "day_of_week": "SUNDAY",
  "day_of_year": 281,
  "week_of_year": 40
}
```

## Performance Features

- **Caching**: Timezone validations and responses are cached for optimal performance
- **Timezone Validation**: Invalid timezones gracefully fallback to UTC
- **Concurrent Safety**: Thread-safe timezone caching using ConcurrentHashMap
- **No-Cache Headers**: Time endpoints include proper cache-control headers to prevent stale data

## Usage Examples

### JavaScript/Frontend
```javascript
// Get UTC time (fastest)
const utcTime = await fetch('/auth-service/v1/server-time/utc').then(r => r.json());

// Get time in specific timezone
const nyTime = await fetch('/auth-service/v1/server-time?timezone=America/New_York').then(r => r.json());

// Validate timezone before using
const isValid = await fetch('/auth-service/v1/server-time/validate-timezone?timezone=Asia/Kolkata').then(r => r.json());
```

### Common Timezone IDs
- `UTC`
- `America/New_York`
- `America/Los_Angeles`
- `Europe/London`
- `Asia/Kolkata`
- `Asia/Tokyo`
- `Australia/Sydney`

## Error Handling

- Invalid timezones automatically fallback to UTC
- All endpoints return proper HTTP status codes
- Comprehensive error logging for debugging
