# Analytics API Caching Implementation

## Overview

This document describes the comprehensive caching implementation for the Analytics API in the auth service. The implementation includes both **application-level caching** (using Redis) and **client-side caching** (using HTTP cache headers).

## Architecture

### Two-Level Caching Strategy

1. **Application-Level Cache (Redis)**
   - Distributed caching across multiple service instances
   - Configurable TTL per endpoint
   - Automatic cache eviction on data updates
   - Fallback to Caffeine (in-memory) if Redis is unavailable

2. **Client-Side Cache (HTTP Headers)**
   - Browser/client caching using Cache-Control headers
   - Reduces network requests
   - Configurable max-age per endpoint

## Cache Configuration

### Cache Names and TTL

| Cache Name | TTL | Endpoint | Description |
|-----------|-----|----------|-------------|
| `analytics:realtime` | 30s | `/active-users/real-time` | Real-time active user counts |
| `analytics:currently-active` | 30s | `/users/currently-active` | Currently active users list |
| `analytics:active-users` | 1m | `/active-users` | Active users in different time ranges |
| `analytics:today` | 2m | `/activity/today` | Today's activity summary |
| `analytics` | 5m | `/user-activity` | Comprehensive analytics |
| `analytics:most-active-users` | 10m | `/users/most-active` | Most active users |
| `analytics:service-usage` | 10m | `/service-usage` | Service usage statistics |
| `analytics:trends` | 15m | `/engagement/trends` | Engagement trends |

### Cache Keys

Caches are keyed by `instituteId` to ensure data isolation between institutes:
- Simple endpoints: `instituteId`
- Most active users: `instituteId:limit` (includes limit parameter)

## API Endpoints with Caching

### 1. Get User Activity Analytics
```
GET /auth-service/v1/analytics/user-activity?instituteId={id}
```
- **Application Cache**: 5 minutes
- **Client Cache**: 5 minutes
- Returns comprehensive analytics data

### 2. Get Real-Time Active Users
```
GET /auth-service/v1/analytics/active-users/real-time?instituteId={id}
```
- **Application Cache**: 30 seconds
- **Client Cache**: 30 seconds
- Returns current active user count

### 3. Get Active Users
```
GET /auth-service/v1/analytics/active-users?instituteId={id}
```
- **Application Cache**: 1 minute
- **Client Cache**: 1 minute
- Returns active users in different time ranges

### 4. Get Today's Activity
```
GET /auth-service/v1/analytics/activity/today?instituteId={id}
```
- **Application Cache**: 2 minutes
- **Client Cache**: 2 minutes
- Returns today's activity summary

### 5. Get Service Usage
```
GET /auth-service/v1/analytics/service-usage?instituteId={id}
```
- **Application Cache**: 10 minutes
- **Client Cache**: 10 minutes
- Returns service usage statistics

### 6. Get Engagement Trends
```
GET /auth-service/v1/analytics/engagement/trends?instituteId={id}
```
- **Application Cache**: 15 minutes
- **Client Cache**: 15 minutes
- Returns engagement trends

### 7. Get Most Active Users
```
GET /auth-service/v1/analytics/users/most-active?instituteId={id}&limit={n}
```
- **Application Cache**: 10 minutes
- **Client Cache**: 10 minutes
- Returns top N most active users

### 8. Get Currently Active Users
```
GET /auth-service/v1/analytics/users/currently-active?instituteId={id}
```
- **Application Cache**: 30 seconds
- **Client Cache**: 30 seconds
- Returns detailed list of currently active users

## Cache Eviction Strategy

### Automatic Eviction

1. **Scheduled Evictions**:
   - Real-time caches: Every 5 minutes
   - Today's activity cache: Every hour
   - All caches: Daily at midnight

2. **On Data Update**:
   - When daily activity is aggregated (1 AM daily)
   - When daily summary is created/updated for an institute

### Manual Eviction

The `AnalyticsCacheEvictionService` provides methods for manual cache eviction:

```java
// Evict all analytics caches for a specific institute
cacheEvictionService.evictInstituteAnalyticsCache(instituteId);

// Evict only real-time caches
cacheEvictionService.evictRealTimeCaches(instituteId);

// Evict today's activity cache
cacheEvictionService.evictTodayActivityCache(instituteId);

// Evict all analytics caches for all institutes
cacheEvictionService.evictAllAnalyticsCaches();
```

## Implementation Files

### Configuration
- **`CacheConfig.java`**: Main cache configuration with Redis and Caffeine setup
  - Defines all cache names as constants
  - Configures TTL for each cache
  - Sets up Redis serialization
  - Provides Caffeine fallback

### Services
- **`AnalyticsCacheEvictionService.java`**: Cache eviction management
  - Manual eviction methods
  - Scheduled eviction tasks
  - Cache statistics logging

- **`DailyActivityAggregationService.java`**: Updated to evict caches on data aggregation

### Controller
- **`UserActivityAnalyticsController.java`**: Updated with caching annotations
  - `@Cacheable` annotations for application-level caching
  - HTTP Cache-Control headers for client-side caching

## Client-Side Caching

All endpoints return HTTP Cache-Control headers for browser caching:

```http
Cache-Control: max-age={seconds}, public
```

This allows browsers and CDNs to cache responses, reducing server load.

### Example Response Headers
```http
HTTP/1.1 200 OK
Cache-Control: max-age=300, public
Content-Type: application/json
```

## Benefits

### Performance Improvements
1. **Reduced Database Load**: Cached queries don't hit the database
2. **Faster Response Times**: Cached responses are served instantly
3. **Reduced Network Traffic**: Client-side caching reduces requests
4. **Scalability**: Distributed Redis cache supports multiple instances

### Cost Savings
1. **Lower CPU Usage**: Less query processing
2. **Lower Memory Usage**: Efficient data storage in Redis
3. **Lower Network Bandwidth**: Client-side caching reduces traffic

### Reliability
1. **Fallback Mechanism**: Caffeine cache when Redis is down
2. **Automatic Eviction**: Ensures fresh data
3. **Configurable TTL**: Balance between freshness and performance

## Monitoring Cache Performance

### Cache Statistics
The service provides cache statistics logging:

```java
cacheEvictionService.logCacheStatistics();
```

### Redis Monitoring
Monitor Redis cache using Redis CLI or monitoring tools:
```bash
# Connect to Redis
redis-cli

# Get all cache keys
KEYS analytics:*

# Get cache statistics
INFO stats

# Monitor cache hits/misses
MONITOR
```

## Configuration Properties

Add these properties to `application.properties`:

```properties
# Enable caching
spring.cache.type=redis

# Redis configuration (already configured)
spring.data.redis.host=redis-service
spring.data.redis.port=6379

# Cache statistics
spring.cache.redis.enable-statistics=true
```

## Best Practices

1. **TTL Selection**:
   - Real-time data: 30 seconds - 1 minute
   - Frequently changing data: 2-5 minutes
   - Historical data: 10-15 minutes

2. **Cache Eviction**:
   - Evict caches when data is updated
   - Use scheduled eviction for stale data prevention
   - Monitor cache hit rates

3. **Error Handling**:
   - Fallback to Caffeine if Redis fails
   - Log cache errors without affecting requests
   - Monitor cache availability

4. **Testing**:
   - Test cache eviction scenarios
   - Verify TTL settings
   - Test Redis failure scenarios

## Troubleshooting

### Cache Not Working
1. Check Redis connection
2. Verify cache configuration
3. Check for cache eviction issues

### Stale Data
1. Verify TTL settings
2. Check cache eviction schedules
3. Manually evict caches if needed

### Performance Issues
1. Monitor Redis memory usage
2. Check cache hit rates
3. Adjust TTL settings if needed

## Future Enhancements

1. **Cache Warming**: Pre-populate caches during low-traffic periods
2. **Advanced Eviction**: Event-driven cache eviction
3. **Cache Metrics**: Detailed cache performance metrics
4. **Dynamic TTL**: Adjust TTL based on data volatility
5. **Cache Compression**: Reduce Redis memory usage

## Related Documentation

- [Spring Cache Documentation](https://docs.spring.io/spring-framework/reference/integration/cache.html)
- [Redis Documentation](https://redis.io/documentation)
- [HTTP Caching (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
