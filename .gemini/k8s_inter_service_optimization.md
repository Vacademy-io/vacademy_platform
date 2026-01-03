# Kubernetes Inter-Service Communication Optimization Guide

## Overview
This document outlines the optimizations made to improve inter-service communication performance within the Kubernetes cluster for the Vacademy platform.

## Problem Statement
Previously, services were potentially using external URLs (e.g., `backend-stage.vacademy.io`) for inter-service communication, which causes:
- **Slower performance** due to external routing through ingress/load balancers
- **TLS termination overhead**
- **Unnecessary DNS lookups to external endpoints**
- **Reduced security** as traffic leaves the cluster
- **Higher latency** (~50-200ms extra per call)

## Solution: Use Kubernetes Internal Service Discovery

### What Changed

#### 1. Updated ConfigMap
**File:** `vacademy_devops/vacademy-services/templates/configmap.yaml`

Added complete internal service URLs using Kubernetes service names:
```yaml
# Internal service URLs for inter-service communication
# Using Kubernetes internal DNS for optimal performance (no external routing)
AUTH_SERVER_BASE_URL: 'http://auth-service:8071'
ADMIN_CORE_SERVICE_BASE_URL: 'http://admin-core-service:8072'
COMMUNITY_SERVICE_BASE_URL: 'http://community-service:8073'
ASSESSMENT_SERVER_BASE_URL: 'http://assessment-service:8074'
MEDIA_SERVER_BASE_URL: 'http://media-service:8075'
MEDIA_SERVICE_BASE_URL: 'http://media-service:8075'
NOTIFICATION_SERVER_BASE_URL: 'http://notification-service:8076'
AI_SERVICE_BASE_URL: 'http://ai-service:8077'
```

#### 2. Fixed Configuration Errors
- `admin_core_service/application-stage.properties`: Fixed `media.server.baseurl` to use `MEDIA_SERVER_BASE_URL` instead of `AUTH_SERVER_BASE_URL`
- `notification_service/application-stage.properties`: Fixed `admin.core.service.baseurl` to use `ADMIN_CORE_SERVICE_BASE_URL` instead of `AUTH_SERVER_BASE_URL`

## How Kubernetes Service Discovery Works

### Internal DNS Resolution
When a service makes a call to `http://auth-service:8071`:

1. **DNS Lookup**: Kubernetes DNS resolves `auth-service` to the ClusterIP
2. **Direct Routing**: Traffic routes directly through the internal cluster network
3. **Load Balancing**: Kubernetes automatically load balances across available pods
4. **No External Hop**: Traffic never leaves the cluster

### DNS Name Formats in Kubernetes

```
# Short form (same namespace)
http://service-name:port

# Fully qualified (explicit namespace)
http://service-name.namespace.svc.cluster.local:port

# Examples:
http://auth-service:8071                              # ✅ Current usage
http://auth-service.default:8071                      # ✅ Explicit namespace
http://auth-service.default.svc.cluster.local:8071   # ✅ Fully qualified
```

Since all services are in the `default` namespace, the short form is sufficient and most performant.

## Performance Benefits

### Before (External URL)
```
Service A → Ingress Controller → External Load Balancer → DNS → 
Ingress Controller → Service B
```
**Latency:** ~50-200ms per call
**Hops:** 5-7
**Security:** Traffic leaves cluster

### After (Internal Service Discovery)
```
Service A → Kubernetes DNS → Service B ClusterIP → Pod B
```
**Latency:** ~2-10ms per call
**Hops:** 2-3
**Security:** Traffic stays within cluster

### Estimated Improvements
- **Latency reduction:** 10-50x faster (50-200ms → 2-10ms)
- **Throughput:** Higher due to reduced overhead
- **Resource usage:** Lower CPU/memory on ingress controllers
- **Cost:** Reduced load balancer usage

## Additional Optimizations to Consider

### 1. Connection Pooling
Ensure your HTTP clients (e.g., RestTemplate, WebClient) are configured with connection pooling:

```java
// Spring RestTemplate with connection pooling
@Bean
public RestTemplate restTemplate() {
    HttpComponentsClientHttpRequestFactory factory = 
        new HttpComponentsClientHttpRequestFactory();
    
    HttpClient httpClient = HttpClientBuilder.create()
        .setMaxConnTotal(100)              // Max total connections
        .setMaxConnPerRoute(20)            // Max connections per route
        .setConnectionTimeToLive(30, TimeUnit.SECONDS)
        .build();
    
    factory.setHttpClient(httpClient);
    factory.setConnectTimeout(5000);       // 5 second connect timeout
    factory.setReadTimeout(10000);         // 10 second read timeout
    
    return new RestTemplate(factory);
}
```

### 2. Use WebClient (Non-blocking)
For better performance with high concurrency, consider migrating from `RestTemplate` to `WebClient`:

```java
@Bean
public WebClient webClient() {
    return WebClient.builder()
        .clientConnector(new ReactorClientHttpConnector(
            HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
                .responseTimeout(Duration.ofSeconds(10))
                .option(ChannelOption.SO_KEEPALIVE, true)
        ))
        .build();
}
```

### 3. Enable HTTP Keep-Alive
Ensure HTTP keep-alive is enabled in your services to reuse connections:

```properties
# application.properties
server.connection-timeout=60000
server.tomcat.connection-timeout=60000
server.tomcat.keep-alive-timeout=60000
server.tomcat.max-keep-alive-requests=100
```

### 4. Service Mesh (Future Enhancement)
Consider implementing a service mesh (Istio, Linkerd) for:
- **Automatic mTLS** between services
- **Circuit breaking** and retries
- **Advanced traffic management**
- **Observability** (distributed tracing)
- **Better load balancing algorithms**

### 5. gRPC for High-Performance APIs
For very high-throughput, low-latency inter-service communication, consider gRPC:
- Binary protocol (faster than JSON)
- HTTP/2 multiplexing
- Built-in connection pooling
- Strong typing with Protocol Buffers

### 6. Redis Caching for Frequently Accessed Data
You already have Redis configured. Use it to cache:
- User authentication tokens
- Frequently accessed reference data
- API responses that don't change often

```java
@Cacheable(value = "users", key = "#userId")
public User getUserById(Long userId) {
    // This will be cached in Redis
    return userRepository.findById(userId).orElseThrow();
}
```

### 7. Async Communication for Non-Critical Paths
For operations that don't need immediate responses:
- Use message queues (RabbitMQ, Kafka)
- Decouple services
- Improve overall system resilience

### 8. Resource Limits and Requests
Ensure proper resource limits in your deployments to prevent resource contention:

```yaml
resources:
  requests:
    cpu: "200m"
    memory: "512Mi"
  limits:
    cpu: "500m"
    memory: "1024Mi"
```

## Monitoring and Validation

### Verify Internal Communication
```bash
# Exec into a pod and test internal DNS
kubectl exec -it <pod-name> -- /bin/sh
wget -O- http://auth-service:8071/auth-service/actuator/health
```

### Monitor Service Performance
```bash
# Check service endpoints
kubectl get endpoints

# Monitor pod-to-pod latency
kubectl logs <pod-name> | grep "http://.*-service"
```

### Application Metrics
Monitor these metrics in your services:
- HTTP request duration
- Connection pool statistics
- Error rates
- Timeout occurrences

## Deployment Steps

After making these changes, deploy to your cluster:

```bash
# Navigate to the Helm chart directory
cd vacademy_devops/vacademy-services

# Update the ConfigMap
helm upgrade vacademy-services . \
  --namespace default \
  --reuse-values

# Restart all services to pick up new environment variables
kubectl rollout restart deployment/auth-service
kubectl rollout restart deployment/admin-core-service
kubectl rollout restart deployment/assessment-service
kubectl rollout restart deployment/media-service
kubectl rollout restart deployment/notification-service
kubectl rollout restart deployment/community-service
kubectl rollout restart deployment/ai-service

# Monitor rollout status
kubectl rollout status deployment/auth-service
kubectl rollout status deployment/admin-core-service
# ... repeat for other services
```

## Testing

After deployment, verify:

1. **Health checks pass**
   ```bash
   kubectl get pods
   # All pods should be Running and Ready
   ```

2. **Inter-service calls work**
   ```bash
   # Check logs for successful inter-service communication
   kubectl logs -f deployment/admin-core-service | grep "http://auth-service"
   ```

3. **External ingress still works**
   ```bash
   curl https://backend-stage.vacademy.io/auth-service/actuator/health
   ```

4. **Performance improvements**
   - Monitor response times in application logs
   - Use APM tools (New Relic, Datadog, etc.) to compare before/after

## Troubleshooting

### Service Not Resolving
```bash
# Check if service exists
kubectl get svc auth-service

# Check service endpoints
kubectl describe svc auth-service

# Test DNS resolution from within a pod
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup auth-service
```

### Connection Timeout
- Verify the service port matches the container port
- Check network policies aren't blocking traffic
- Ensure pods are healthy and ready

### Wrong Service Being Called
- Double-check environment variable names match across all services
- Verify ConfigMap is properly mounted in deployments

## Summary

✅ **Completed:**
- Added all internal service URLs to ConfigMap
- Fixed incorrect environment variable references
- Documented the optimization approach

🚀 **Next Steps:**
1. Deploy updated ConfigMap
2. Restart services to pick up new environment variables
3. Monitor performance improvements
4. Consider implementing additional optimizations (connection pooling, WebClient, etc.)

**Expected Outcome:**
- **10-50x faster** inter-service communication
- **More reliable** as traffic stays within cluster
- **Better security** with internal-only communication
- **Lower costs** due to reduced load balancer usage
