# Analytics Caching - Quick Reference

## 📋 At a Glance

**Status**: ✅ Implemented and Ready  
**Cache Type**: Two-level (Redis + Client-side)  
**Dependencies**: All required dependencies already present in `pom.xml`

---

## 🔧 Cache Configuration

| Endpoint | Application Cache | Client Cache | Key |
|----------|------------------|--------------|-----|
| `/user-activity` | 5 min | 5 min | `instituteId` |
| `/active-users/real-time` | 30 sec | 30 sec | `instituteId` |
| `/active-users` | 1 min | 1 min | `instituteId` |
| `/activity/today` | 2 min | 2 min | `instituteId` |
| `/service-usage` | 10 min | 10 min | `instituteId` |
| `/engagement/trends` | 15 min | 15 min | `instituteId` |
| `/users/most-active` | 10 min | 10 min | `instituteId:limit` |
| `/users/currently-active` | 30 sec | 30 sec | `instituteId` |

---

## 🚀 Quick Start

### 1. Testing Cache

```bash
# First request (cache miss - slower)
curl -w "%{time_total}s\n" "http://localhost:8080/auth-service/v1/analytics/user-activity?instituteId=test123"

# Second request (cache hit - faster)
curl -w "%{time_total}s\n" "http://localhost:8080/auth-service/v1/analytics/user-activity?instituteId=test123"
```

### 2. Verify Cache Headers

```bash
curl -I "http://localhost:8080/auth-service/v1/analytics/user-activity?instituteId=test123"
# Look for: Cache-Control: max-age=300, public
```

### 3. Check Redis

```bash
redis-cli
> KEYS analytics:*
> GET "analytics::test123"
> TTL "analytics::test123"
```

---

## 💻 Code Examples

### Manual Cache Eviction

```java
@Autowired
private AnalyticsCacheEvictionService cacheEvictionService;

// Evict all analytics for one institute
cacheEvictionService.evictInstituteAnalyticsCache("institute123");

// Evict only real-time caches
cacheEvictionService.evictRealTimeCaches("institute123");

// Evict everything
cacheEvictionService.evictAllAnalyticsCaches();
```

### Adding Caching to New Endpoint

```java
@GetMapping("/my-new-endpoint")
@Cacheable(value = CacheConfig.ANALYTICS_CACHE, key = "#instituteId")
public ResponseEntity<MyDto> getMyAnalytics(
        @RequestParam("instituteId") String instituteId) {
    
    MyDto data = service.getData(instituteId);
    
    return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
            .body(data);
}
```

---

## 🔄 Automatic Cache Management

### Scheduled Evictions
- **Every 5 minutes**: Clear real-time caches
- **Every hour**: Clear today's activity cache
- **Daily at midnight**: Clear all caches

### Event-Driven Evictions
- **Daily at 1 AM**: After data aggregation → Clear all caches
- **On summary update**: When institute data changes → Clear institute caches

---

## 📊 Cache Names (Constants)

```java
CacheConfig.ANALYTICS_CACHE                   // 5 min
CacheConfig.ANALYTICS_REALTIME_CACHE          // 30 sec
CacheConfig.ANALYTICS_ACTIVE_USERS_CACHE      // 1 min
CacheConfig.ANALYTICS_TODAY_CACHE             // 2 min
CacheConfig.ANALYTICS_SERVICE_USAGE_CACHE     // 10 min
CacheConfig.ANALYTICS_TRENDS_CACHE            // 15 min
CacheConfig.ANALYTICS_MOST_ACTIVE_USERS_CACHE // 10 min
CacheConfig.ANALYTICS_CURRENTLY_ACTIVE_CACHE  // 30 sec
```

---

## 🐛 Troubleshooting

### Cache Not Working?

```bash
# 1. Check Redis is running
kubectl get pods | grep redis

# 2. Check Redis connection
redis-cli -h redis-service -p 6379 PING

# 3. Check application logs
kubectl logs <auth-service-pod> | grep -i cache

# 4. Verify cache configuration
# Ensure spring.cache.type=redis in application.properties
```

### Stale Data?

```bash
# Manual eviction from Redis
redis-cli
> DEL "analytics::institute123"
> FLUSHDB  # Clear all (use with caution!)

# Or use the eviction service
curl -X POST "http://localhost:8080/auth-service/internal/cache/evict/institute123"
```

---

## 📈 Performance Metrics

### Expected Improvements
- **Response Time**: 50-90% reduction for cached requests
- **Database Load**: 70-95% reduction in query count
- **Network Bandwidth**: 60-80% reduction (with client-side caching)

### Monitoring

```java
// Log cache statistics
cacheEvictionService.logCacheStatistics();
```

```bash
# Redis stats
redis-cli INFO stats | grep -E "hits|misses"
```

---

## ⚠️ Important Notes

1. **Cache Isolation**: Caches are keyed by `instituteId` - no cross-institute data leakage
2. **Fallback**: Caffeine in-memory cache activates if Redis is down
3. **Thread-Safe**: Spring Cache handles concurrent access automatically
4. **Null Values**: Null responses are NOT cached (configured in CacheConfig)
5. **Eviction**: Manual eviction is available but automatic eviction handles most cases

---

## 📚 Documentation

- **Detailed Guide**: `ANALYTICS_CACHING.md`
- **Architecture**: `CACHING_ARCHITECTURE.md`
- **Implementation Summary**: `CACHING_IMPLEMENTATION_SUMMARY.md`

---

## 🔑 Key Files

```
auth_service/
├── src/main/java/vacademy/io/auth_service/
│   ├── config/
│   │   └── CacheConfig.java                          # Cache configuration
│   └── feature/analytics/
│       ├── controller/
│       │   └── UserActivityAnalyticsController.java  # Endpoints with caching
│       └── service/
│           ├── AnalyticsCacheEvictionService.java    # Cache management
│           └── DailyActivityAggregationService.java  # Auto eviction
└── docs/
    ├── ANALYTICS_CACHING.md                          # Full documentation
    ├── CACHING_ARCHITECTURE.md                       # Architecture diagram
    └── CACHING_IMPLEMENTATION_SUMMARY.md             # Implementation summary
```

---

## ✅ Checklist for Using Caching

- [ ] Redis is running and accessible
- [ ] `spring.cache.type=redis` is set
- [ ] New endpoints have `@Cacheable` annotation
- [ ] HTTP `Cache-Control` headers are set
- [ ] Appropriate TTL is chosen for data volatility
- [ ] Cache eviction is handled for data updates
- [ ] Cache keys are unique per institute
- [ ] Null values are handled (not cached)
- [ ] Monitoring is in place

---

**Need Help?** See detailed documentation in `ANALYTICS_CACHING.md`
