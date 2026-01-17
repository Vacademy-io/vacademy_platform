# API Latency Analysis Guide - Using Sentry Performance Monitoring

## Table of Contents

1. [Automatic Tracing Solution (Recommended)](#automatic-tracing-solution)
2. [Understanding Where Latency Comes From](#understanding-where-latency-comes-from)
3. [Quick Diagnosis with curl](#quick-diagnosis-with-curl)
4. [Sentry Performance Tracing](#sentry-performance-tracing)
5. [Reading Sentry Performance Dashboard](#reading-sentry-performance-dashboard)
6. [Common Latency Causes & Solutions](#common-latency-causes--solutions)

---

## Automatic Tracing Solution

We've implemented a **zero-configuration** tracing solution that works for **ALL APIs** across all microservices. Once deployed, you'll automatically get performance monitoring without any code changes!

### Components Included

| Component              | What it Does                                 | Configuration               |
| ---------------------- | -------------------------------------------- | --------------------------- |
| `RequestTracingFilter` | Logs ALL HTTP requests with timing           | Automatic for all endpoints |
| `SlowQueryLogger`      | Logs slow Repository/Service/Manager methods | Uses Spring AOP (automatic) |
| `@Traced` annotation   | Custom tracing for specific methods          | Opt-in per method           |
| `PerformanceTracer`    | Programmatic tracing utility                 | Use in code as needed       |

### Automatic Thresholds

| Level       | Request Time | Query/Service Time | What Happens                 |
| ----------- | ------------ | ------------------ | ---------------------------- |
| ✅ Normal   | < 3s         | < 1s               | Debug log only               |
| ⚠️ Warning  | 3s - 30s     | 1s - 10s           | Warn log + Sentry breadcrumb |
| 🔴 Critical | > 30s        | > 10s              | Error log + Sentry event     |

### What You'll See in Logs (Automatically!)

```
✅ GET /api/users | Status: 200 | Duration: 45ms | Client: 192.168.1.1
🟡 SLOW REQUEST: GET /api/reports | Status: 200 | Duration: 4523ms | Client: 192.168.1.1
🔴 CRITICAL SLOW REQUEST: GET /api/heavy-data | Status: 200 | Duration: 65000ms
🟡 SLOW REPOSITORY [UserRepository.findByEmail] took 1234ms | Args: ["test@email.com"]
🔴 CRITICAL SLOW SERVICE [ReportService.generateReport] took 45000ms | Args: [...]
```

### How to Use @Traced Annotation

For methods you want to explicitly trace with custom naming:

```java
import vacademy.io.common.tracing.Traced;

@Service
public class PaymentService {

    @Traced(operation = "payment.process", description = "Process payment transaction")
    public PaymentResult processPayment(Order order) {
        // This will create a named span in Sentry
        // ...
    }

    @Traced(operation = "external.api", slowThresholdMs = 5000)
    public ExternalData fetchFromExternalAPI(String id) {
        // Custom slow threshold of 5 seconds
        // ...
    }
}
```

---

## Understanding Where Latency Comes From

API latency can originate from multiple layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                         REQUEST JOURNEY                                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [Client] ──DNS──▶ [CDN/LB] ──▶ [Ingress] ──▶ [Service] ──▶ [DB]     │
│     │                │             │            │            │         │
│   ~1-50ms        ~10-100ms     ~1-10ms     ~10-500ms    ~10-5000ms  │
│                                                                        │
│  • DNS Resolution              • Route Matching   • Business Logic    │
│  • TCP Handshake               • TLS Termination  • DB Queries       │
│  • TLS Negotiation             • Rate Limiting    • External Calls   │
│  • Geographic Distance                            • Serialization     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Diagnosis with curl

Use curl's timing capabilities to get a high-level breakdown:

### Create a timing format file:

```bash
cat > /tmp/curl-format.json << 'EOF'
{
    "time_namelookup": %{time_namelookup}s,
    "time_connect": %{time_connect}s,
    "time_appconnect": %{time_appconnect}s,
    "time_pretransfer": %{time_pretransfer}s,
    "time_starttransfer": %{time_starttransfer}s,
    "time_total": %{time_total}s,
    "size_download_bytes": %{size_download}
}
EOF
```

### Run your API with timing:

```bash
curl -w "@/tmp/curl-format.json" -o /tmp/response.json -s \
  --request GET \
  --url 'https://backend-stage.vacademy.io/admin-core-service/institute/v1/details/YOUR_INSTITUTE_ID' \
  --header 'Authorization: Bearer YOUR_TOKEN'
```

### Understanding the Output:

| Metric               | Meaning                    | Typical Value | If Slow...                     |
| -------------------- | -------------------------- | ------------- | ------------------------------ |
| `time_namelookup`    | DNS resolution             | <50ms         | DNS issues or cold start       |
| `time_connect`       | TCP connection             | <100ms        | Network distance or congestion |
| `time_appconnect`    | TLS handshake              | <200ms        | SSL/TLS issues                 |
| `time_starttransfer` | First byte received (TTFB) | <500ms        | **Server processing time**     |
| `time_total`         | Complete response          | <1000ms       | Response size or serialization |

**If `time_starttransfer` is high (e.g., >1 minute), the slowness is in your backend application.**

---

## Sentry Performance Tracing

Sentry is already integrated in your project. After deploying the updated code, you'll see detailed performance traces.

### What Gets Traced Automatically:

- All HTTP requests to your endpoints
- Database queries (if using Spring Data JPA)
- Spring bean method calls

### What We Added (Custom Traces):

For the `/admin-core-service/institute/v1/details/{instituteId}` endpoint, we now trace:

1. `db.query: instituteRepository.findById` - Main institute lookup
2. `db.query: instituteModuleService.getSubmoduleIdsForInstitute` - Module lookup
3. `db.query: packageRepository.findAllDistinctTagsByInstituteId` - Tags lookup
4. `db.query: packageRepository.findDistinctSessionsByInstituteIdAndStatusIn` - Sessions
5. `db.query: packageRepository.findDistinctLevelsByInstituteIdAndStatusIn` - Levels
6. `db.query: packageGroupMappingRepository.findAllByInstituteId` - Package groups
7. `db.query: packageSessionRepository.findPackageSessionsByInstituteId` - Package sessions
8. `compute.heavy: slideService.calculateReadTimesForPackageSessions` - **LIKELY SLOWEST**
9. `db.query: subjectRepository.findDistinctSubjectsByInstituteId` - Subjects

---

## Reading Sentry Performance Dashboard

### Step 1: Open Sentry Dashboard

1. Go to [sentry.io](https://sentry.io) and log in
2. Select your project
3. Click **Performance** in the left sidebar

### Step 2: Find Your Transaction

1. Search for `GET /admin-core-service/institute/v1/details`
2. Click on the transaction to see details

### Step 3: Analyze the Waterfall

You'll see something like:

```
GET /admin-core-service/institute/v1/details/{instituteId}
├── db.query: instituteRepository.findById ─────────────── 45ms
├── db.query: instituteModuleService.getSubmoduleIdsForInstitute ── 120ms
├── db.query: packageRepository.findAllDistinctTagsByInstituteId ── 85ms
├── db.query: packageRepository.findDistinctSessionsByInstituteIdAndStatusIn ── 156ms
├── db.query: packageRepository.findDistinctLevelsByInstituteIdAndStatusIn ── 78ms
├── db.query: packageGroupMappingRepository.findAllByInstituteId ── 92ms
├── db.query: packageSessionRepository.findPackageSessionsByInstituteId ── 234ms
├── compute.heavy: slideService.calculateReadTimesForPackageSessions ── 52,340ms ⚠️ SLOW!
└── db.query: subjectRepository.findDistinctSubjectsByInstituteId ── 167ms
```

The span with the longest duration is your bottleneck!

### Step 4: Drill Down

Click on any span to see:

- **Duration**: How long it took
- **Tags**: Context like institute ID
- **Database query**: Actual SQL if available

---

## Common Latency Causes & Solutions

### 1. **Slow Database Queries**

**Symptoms**: `db.query` spans taking >500ms

**Diagnosis**:

```sql
-- Check for missing indexes
EXPLAIN ANALYZE SELECT * FROM your_table WHERE institute_id = 'xxx';
```

**Solutions**:

- Add indexes on frequently queried columns
- Use `@QueryHints` for read-only queries
- Consider caching with `@Cacheable`

### 2. **N+1 Query Problem**

**Symptoms**: Many small `db.query` spans adding up

**Solutions**:

- Use `JOIN FETCH` in JPA queries
- Use `@EntityGraph` for eager loading
- Batch queries (like we did with `calculateReadTimesForPackageSessions`)

### 3. **Heavy Computation**

**Symptoms**: `compute.heavy` spans taking long

**Solutions**:

- Pre-calculate and cache results
- Move to async processing
- Use database aggregations instead of Java processing

### 4. **Database Connection Exhaustion**

**Symptoms**: Random long waits before any query

**Diagnosis**:

```yaml
# Check HikariCP metrics
management.endpoints.web.exposure.include=health,metrics
```

**Solutions**:

```properties
# Increase pool size
spring.datasource.hikari.maximum-pool-size=20
```

### 5. **Kubernetes/Infrastructure Issues**

**Symptoms**: Inconsistent latency, sometimes fast, sometimes 1+ minute

**Possible Causes**:

- Pod cold starts
- Resource limits hit
- Network policies
- Database pod restarts

**Diagnosis**:

```bash
# Check pod events
kubectl describe pod <pod-name>

# Check resource usage
kubectl top pod <pod-name>
```

---

## Using PerformanceTracer in Your Code

### Basic Usage:

```java
import vacademy.io.common.tracing.PerformanceTracer;

// Trace a database query
MyEntity result = PerformanceTracer.traceDbQuery(
    "myRepository.findById",
    () -> myRepository.findById(id).orElseThrow()
);

// Trace a slow computation
List<Result> results = PerformanceTracer.trace(
    "compute.heavy",
    "processLargeDataset",
    () -> processLargeDataset(data)
);

// Trace an HTTP call to another service
Response response = PerformanceTracer.traceHttpCall(
    "POST",
    "https://api.example.com/endpoint",
    () -> httpClient.post(url, body)
);
```

### With Tags (for filtering in Sentry):

```java
Result result = PerformanceTracer.TraceBuilder.of(
    "db.query",
    "complexQuery",
    () -> repository.complexQuery(params)
)
.withTag("institute_id", instituteId)
.withTag("query_type", "aggregation")
.execute();
```

---

## Sentry Configuration Reference

Your current configuration in `application.properties`:

```properties
sentry.dsn=${SENTRY_DSN}
sentry.send-default-pii=true
sentry.logs.enabled=true
sentry.traces-sample-rate=1.0   # 100% of transactions are traced
sentry.trace-propagation-targets=localhost,127.0.0.1
sentry.in-app-includes=vacademy.io
```

For production, consider reducing `traces-sample-rate` to save costs:

```properties
# Sample 10% of transactions
sentry.traces-sample-rate=0.1
```

---

## Next Steps

1. **Deploy the updated code** - The `InstituteInitManager` now has performance tracing
2. **Wait for traces** - After deployment, make a few API calls
3. **Check Sentry Dashboard** - Go to Performance → Transactions
4. **Identify the bottleneck** - Look for the longest span
5. **Optimize** - Apply the appropriate solution based on the cause

## Need More Help?

- [Sentry Spring Boot Integration](https://docs.sentry.io/platforms/java/guides/spring-boot/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Spring Data JPA Optimization](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/)
