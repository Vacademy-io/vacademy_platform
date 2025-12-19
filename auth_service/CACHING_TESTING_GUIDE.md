# Analytics Caching - Testing Guide

## Prerequisites

✅ Auth service is running  
✅ Redis is running and accessible  
✅ You have a valid JWT token for authentication

---

## Test 1: Basic Cache Functionality

### Step 1: First Request (Cache Miss)

```bash
# Time the request
time curl -X GET \
  "http://localhost:8080/auth-service/v1/analytics/user-activity?instituteId=test123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: Slow response (~200-500ms), database queries executed

### Step 2: Second Request (Cache Hit)

```bash
# Same request - should be faster
time curl -X GET \
  "http://localhost:8080/auth-service/v1/analytics/user-activity?instituteId=test123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: Fast response (~50-100ms), no database queries

### Step 3: Verify Cache Headers

```bash
curl -I \
  "http://localhost:8080/auth-service/v1/analytics/user-activity?instituteId=test123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Headers**:
```
HTTP/1.1 200 OK
Cache-Control: max-age=300, public
Content-Type: application/json
```

---

## Test 2: Redis Cache Verification

### Check Redis for Cached Data

```bash
# Connect to Redis
redis-cli -h redis-service -p 6379

# List all analytics cache keys
> KEYS analytics:*

# Get a specific cache value
> GET "analytics::test123"

# Check TTL (should be around 300 seconds)
> TTL "analytics::test123"

# Monitor real-time cache operations
> MONITOR
```

**Expected**: You should see cache keys like `analytics::test123` with appropriate TTL

---

## Test 3: Different Endpoints with Different TTLs

### Real-time Endpoint (30 seconds TTL)

```bash
curl -I \
  "http://localhost:8080/auth-service/v1/analytics/active-users/real-time?instituteId=test123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: `Cache-Control: max-age=30, public`

### Today's Activity (2 minutes TTL)

```bash
curl -I \
  "http://localhost:8080/auth-service/v1/analytics/activity/today?instituteId=test123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: `Cache-Control: max-age=120, public`

### Engagement Trends (15 minutes TTL)

```bash
curl -I \
  "http://localhost:8080/auth-service/v1/analytics/engagement/trends?instituteId=test123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: `Cache-Control: max-age=900, public`

---

## Test 4: Cache Isolation

### Test 1: Different Institutes

```bash
# Request for institute1
curl -X GET \
  "http://localhost:8080/auth-service/v1/analytics/user-activity?instituteId=institute1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Request for institute2
curl -X GET \
  "http://localhost:8080/auth-service/v1/analytics/user-activity?instituteId=institute2" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Verify separate cache entries in Redis
redis-cli
> KEYS analytics::*
```

**Expected**: Two separate cache entries:
- `analytics::institute1`
- `analytics::institute2`

---

## Test 5: Manual Cache Eviction

### Test Eviction API

```bash
# Evict cache for specific institute
curl -X DELETE \
  "http://localhost:8080/auth-service/v1/analytics/cache/institute/test123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected response:
# {
#   "status": "success",
#   "message": "Analytics cache evicted for institute: test123",
#   "timestamp": "2025-12-19T13:49:23.456Z"
# }

# Verify cache is deleted in Redis
redis-cli
> GET "analytics::test123"
# Expected: (nil)
```

### Test Real-time Cache Eviction

```bash
curl -X DELETE \
  "http://localhost:8080/auth-service/v1/analytics/cache/institute/test123/realtime" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Full Cache Eviction (Use with Caution!)

```bash
curl -X DELETE \
  "http://localhost:8080/auth-service/v1/analytics/cache/all" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Verify all caches are gone
redis-cli
> KEYS analytics:*
# Expected: (empty array)
```

---

## Test 6: Cache Health Check

```bash
curl -X GET \
  "http://localhost:8080/auth-service/v1/analytics/cache/health" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response**:
```json
{
  "status": "healthy",
  "cacheType": "redis-with-caffeine-fallback",
  "timestamp": "2025-12-19T13:49:23.456Z",
  "configuredCaches": {
    "analytics": "5 minutes TTL",
    "analytics:realtime": "30 seconds TTL",
    "analytics:active-users": "1 minute TTL",
    "analytics:today": "2 minutes TTL",
    "analytics:service-usage": "10 minutes TTL",
    "analytics:trends": "15 minutes TTL",
    "analytics:most-active-users": "10 minutes TTL",
    "analytics:currently-active": "30 seconds TTL"
  }
}
```

---

## Test 7: TTL Expiration

### Test Automatic Expiration

```bash
# Step 1: Make a request to cache data
curl -X GET \
  "http://localhost:8080/auth-service/v1/analytics/active-users/real-time?instituteId=test123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Step 2: Check TTL immediately
redis-cli
> TTL "analytics:realtime::test123"
# Expected: ~30 (seconds)

# Step 3: Wait 31 seconds
sleep 31

# Step 4: Check if cache is expired
redis-cli
> GET "analytics:realtime::test123"
# Expected: (nil)

# Step 5: Next request should be a cache miss (slower)
time curl -X GET \
  "http://localhost:8080/auth-service/v1/analytics/active-users/real-time?instituteId=test123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Test 8: Redis Failure Fallback

### Simulate Redis Failure

```bash
# Stop Redis (Kubernetes)
kubectl scale deployment redis-deployment --replicas=0

# Make a request - should still work (using Caffeine)
curl -X GET \
  "http://localhost:8080/auth-service/v1/analytics/user-activity?instituteId=test123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check logs - should see fallback messages
kubectl logs <auth-service-pod> | grep -i "cache\|caffeine"

# Restore Redis
kubectl scale deployment redis-deployment --replicas=1
```

**Expected**: Service continues working with Caffeine fallback

---

## Test 9: Performance Benchmark

### Load Test Script

```bash
#!/bin/bash

ENDPOINT="http://localhost:8080/auth-service/v1/analytics/user-activity?instituteId=test123"
TOKEN="YOUR_JWT_TOKEN"
REQUESTS=100

echo "Running $REQUESTS requests..."

# First request (cache miss)
echo "=== First Request (Cache Miss) ==="
time curl -s -X GET "$ENDPOINT" -H "Authorization: Bearer $TOKEN" > /dev/null

# Subsequent requests (cache hit)
echo "=== Subsequent Requests (Cache Hit) ==="
total_time=0
for i in $(seq 1 $REQUESTS); do
  time_taken=$(curl -s -o /dev/null -w "%{time_total}" -X GET "$ENDPOINT" -H "Authorization: Bearer $TOKEN")
  total_time=$(echo "$total_time + $time_taken" | bc)
  echo "Request $i: ${time_taken}s"
done

avg_time=$(echo "scale=4; $total_time / $REQUESTS" | bc)
echo "Average time: ${avg_time}s"
```

**Expected**:
- First request: 0.2-0.5s
- Cached requests: 0.05-0.1s
- Average: <0.1s

---

## Test 10: Client-Side Caching

### Browser Test

```javascript
// Open browser console on your frontend app
// Make a request
fetch('/auth-service/v1/analytics/user-activity?instituteId=test123', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
})
.then(response => {
  console.log('Cache-Control:', response.headers.get('Cache-Control'));
  return response.json();
});

// Make the same request again - should be served from browser cache
// Check Network tab - status should be "200 (from disk cache)" or "(from memory cache)"
```

---

## Test 11: Application Logs

### Check Cache Events

```bash
# Check cache hits and misses
kubectl logs <auth-service-pod> | grep -i "cache"

# Check eviction events
kubectl logs <auth-service-pod> | grep -i "evict"

# Check Redis connection
kubectl logs <auth-service-pod> | grep -i "redis"
```

**Expected Log Patterns**:
```
[INFO] Initializing Redis cache manager for analytics
[DEBUG] Evicted key test123 from cache analytics
[INFO] Scheduled eviction of real-time analytics caches
[INFO] Successfully evicted analytics cache for institute: test123
```

---

## Test 12: Stress Test

### Concurrent Requests

```bash
# Use Apache Bench
ab -n 1000 -c 10 -H "Authorization: Bearer YOUR_JWT_TOKEN" \
   "http://localhost:8080/auth-service/v1/analytics/user-activity?instituteId=test123"

# Check results
# - Time per request should be much lower for cached requests
# - Requests per second should be high
# - No failed requests
```

---

## Verification Checklist

After running all tests, verify:

- [x] Cache hit ratio > 90% for repeated requests
- [x] Response time reduced by 50-90% for cached requests
- [x] HTTP Cache-Control headers present in all responses
- [x] Redis contains cache entries with correct TTL
- [x] Different institutes have separate cache entries
- [x] Manual eviction API works correctly
- [x] Automatic eviction happens as scheduled
- [x] Service works when Redis is down (Caffeine fallback)
- [x] Client-side caching works in browser
- [x] No cache data leakage between institutes

---

## Troubleshooting

### Issue: Cache not working

**Possible Causes**:
1. Redis is not running
2. Spring cache is disabled
3. Cache keys are incorrect

**Solution**:
```bash
# Check Redis
kubectl get pods | grep redis
redis-cli PING

# Check application.properties
cat application.properties | grep cache

# Check logs
kubectl logs <pod> | grep -i cache
```

### Issue: Stale data in cache

**Possible Causes**:
1. Cache eviction not working
2. TTL too high

**Solution**:
```bash
# Manual eviction
curl -X DELETE "http://localhost:8080/auth-service/v1/analytics/cache/institute/test123"

# Or clear all
redis-cli FLUSHDB
```

### Issue: High memory usage in Redis

**Solution**:
```bash
# Check Redis memory
redis-cli INFO memory

# Reduce TTL or max entries if needed
# Clear old data
redis-cli --scan --pattern "analytics:*" | xargs redis-cli DEL
```

---

## Success Criteria

✅ **Cache Hit Rate**: >90% for repeated requests  
✅ **Response Time**: ~50-100ms for cached requests  
✅ **Database Load**: <10% of requests hit database  
✅ **Client Caching**: Browser serves from cache  
✅ **Eviction**: Manual and automatic eviction working  
✅ **Failover**: Service works when Redis is down  
✅ **Isolation**: No data leakage between institutes  

---

**Testing Complete!** 🎉

If all tests pass, your caching implementation is ready for production.
