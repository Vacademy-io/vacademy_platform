package vacademy.io.community_service.feature.diagnostics.service;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.Configuration;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.models.*;
import io.kubernetes.client.util.Config;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vacademy.io.community_service.feature.diagnostics.dto.InfrastructureHealthResponse;
import vacademy.io.community_service.feature.diagnostics.dto.InfrastructureHealthResponse.*;

import jakarta.annotation.PostConstruct;
import javax.sql.DataSource;
import java.io.IOException;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Diagnostics Service - Provides comprehensive infrastructure health monitoring
 * 
 * This service queries:
 * 1. Kubernetes API for pod/deployment status
 * 2. All application services for health checks
 * 3. Redis for connectivity
 * 4. PostgreSQL for database health
 * 5. Inter-service connectivity
 */
@Slf4j
@Service
public class DiagnosticsService {

    @Value("${REDIS_HOST:redis}")
    private String redisHost;

    @Value("${REDIS_PORT:6379}")
    private int redisPort;

    @Autowired
    private DataSource dataSource;

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    private CoreV1Api coreV1Api;
    private AppsV1Api appsV1Api;
    private boolean k8sAvailable = false;

    @PostConstruct
    public void init() {

        // Initialize Kubernetes client (works when running in-cluster)
        try {
            ApiClient client = Config.fromCluster();
            client.setReadTimeout(10000);
            Configuration.setDefaultApiClient(client);
            this.coreV1Api = new CoreV1Api();
            this.appsV1Api = new AppsV1Api();
            this.k8sAvailable = true;
            log.info("Kubernetes API client initialized successfully");
        } catch (IOException e) {
            log.warn("Running outside Kubernetes cluster, K8s features disabled: {}", e.getMessage());
            this.k8sAvailable = false;
        }
    }

    /**
     * Get complete infrastructure health
     */
    public InfrastructureHealthResponse getInfrastructureHealth() {
        Instant start = Instant.now();

        // Run all checks in parallel
        // Run checks
        CompletableFuture<KubernetesInfrastructure> k8sFuture = CompletableFuture
                .supplyAsync(this::getKubernetesInfrastructure);
        CompletableFuture<DependencyHealth> depsFuture = CompletableFuture.supplyAsync(this::checkDependencies);
        CompletableFuture<List<KubernetesEvent>> eventsFuture = CompletableFuture
                .supplyAsync(this::getRecentKubernetesEvents);

        // Services and Connectivity are now static/client-side focused, no need for
        // async fetch
        List<ServiceHealth> services = checkAllServices();
        List<ConnectivityCheck> connectivity = checkConnectivity();

        // Wait for async checks
        CompletableFuture.allOf(k8sFuture, depsFuture, eventsFuture).join();

        KubernetesInfrastructure k8sHealth = k8sFuture.join();
        DependencyHealth deps = depsFuture.join();
        List<KubernetesEvent> events = eventsFuture.join();

        // Determine overall status
        String overallStatus = determineOverallStatus(k8sHealth, services, deps, connectivity);

        return InfrastructureHealthResponse.builder()
                .timestamp(Instant.now())
                .overallStatus(overallStatus)
                .kubernetesInfrastructure(k8sHealth)
                .applicationServices(services)
                .dependencies(deps)
                .connectivityMatrix(connectivity)
                .recentEvents(events)
                .build();
    }

    /**
     * Quick health check - lightweight
     */
    public Map<String, Object> getQuickHealth() {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("timestamp", Instant.now());

        // Check services quickly
        // Return service configurations for frontend to check
        Map<String, Object> services = new LinkedHashMap<>();
        services.put("auth-service", createQuickServiceConfig("/auth-service/actuator/health"));
        services.put("admin-core-service", createQuickServiceConfig("/admin-core-service/actuator/health"));
        services.put("media-service", createQuickServiceConfig("/media-service/actuator/health"));
        services.put("assessment-service", createQuickServiceConfig("/assessment-service/actuator/health"));
        services.put("notification-service", createQuickServiceConfig("/notification-service/actuator/health"));

        // Community service is UP (we are here)
        services.put("community-service", Map.of(
                "status", "UP",
                "response_time_ms", 0,
                "public_endpoint", "/community-service/actuator/health"));

        health.put("services", services);

        // Check Redis
        health.put("redis", checkRedisQuick());

        // Check Database
        health.put("database", checkDatabaseQuick());

        // Overall
        // Overall status depends on local dependencies (services are checked
        // client-side)
        @SuppressWarnings("unchecked")
        Map<String, Object> redisHealth = (Map<String, Object>) health.get("redis");
        @SuppressWarnings("unchecked")
        Map<String, Object> dbHealth = (Map<String, Object>) health.get("database");

        boolean redisUp = "UP".equals(redisHealth.get("status"));
        boolean dbUp = "UP".equals(dbHealth.get("status"));

        health.put("overall_status", (redisUp && dbUp) ? "HEALTHY" : "DEGRADED");

        return health;
    }

    /**
     * Get Kubernetes pod status
     */
    public Map<String, Object> getKubernetesPodStatus() {
        Map<String, Object> result = new LinkedHashMap<>();

        if (!k8sAvailable) {
            result.put("status", "K8S_UNAVAILABLE");
            result.put("message", "Running outside Kubernetes cluster");
            return result;
        }

        try {
            // Get pods from all relevant namespaces
            result.put("default", getPodsInNamespace("default"));
            result.put("ingress-nginx", getPodsInNamespace("ingress-nginx"));
            result.put("cert-manager", getPodsInNamespace("cert-manager"));
            result.put("kube-system", getPodsInNamespace("kube-system"));
        } catch (ApiException e) {
            log.error("Failed to get K8s pods: {}", e.getMessage());
            result.put("error", e.getMessage());
        }

        return result;
    }

    /**
     * Get connectivity status between services
     */
    public List<ConnectivityCheck> getConnectivityStatus() {
        return checkConnectivity();
    }

    /**
     * Get recent Kubernetes events
     */
    public List<KubernetesEvent> getRecentEvents() {
        return getRecentKubernetesEvents();
    }

    /**
     * Get database health
     */
    public Map<String, Object> getDatabaseHealth() {
        Map<String, Object> result = new LinkedHashMap<>();

        try {
            long start = System.currentTimeMillis();
            try (Connection conn = dataSource.getConnection()) {
                boolean valid = conn.isValid(5);
                long responseTime = System.currentTimeMillis() - start;

                result.put("status", valid ? "UP" : "DOWN");
                result.put("connected", valid);
                result.put("response_time_ms", responseTime);
                result.put("database", conn.getCatalog());
                result.put("url", conn.getMetaData().getURL().replaceAll("password=.*?(&|$)", "password=***$1"));
            }
        } catch (SQLException e) {
            result.put("status", "DOWN");
            result.put("connected", false);
            result.put("error", e.getMessage());
        }

        return result;
    }

    /**
     * Get Redis health
     */
    public Map<String, Object> getRedisHealth() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("host", redisHost);
        result.put("port", redisPort);

        if (redisTemplate == null) {
            result.put("status", "UNAVAILABLE");
            result.put("message", "Redis not configured");
            return result;
        }

        try {
            long start = System.currentTimeMillis();
            String pong = redisTemplate.getConnectionFactory().getConnection().ping();
            long responseTime = System.currentTimeMillis() - start;

            result.put("status", "PONG".equals(pong) ? "UP" : "DOWN");
            result.put("connected", true);
            result.put("response_time_ms", responseTime);
        } catch (Exception e) {
            result.put("status", "DOWN");
            result.put("connected", false);
            result.put("error", e.getMessage());
        }

        return result;
    }

    // ========== Private Helper Methods ==========

    private KubernetesInfrastructure getKubernetesInfrastructure() {
        if (!k8sAvailable) {
            return KubernetesInfrastructure.builder()
                    .ingressNginx(ComponentHealth.builder().status("UNKNOWN").build())
                    .certManager(ComponentHealth.builder().status("UNKNOWN").build())
                    .calicoNetwork(ComponentHealth.builder().status("UNKNOWN").build())
                    .coredns(ComponentHealth.builder().status("UNKNOWN").build())
                    .loadBalancer(LoadBalancerHealth.builder().status("UNKNOWN").build())
                    .build();
        }

        try {
            return KubernetesInfrastructure.builder()
                    .ingressNginx(getComponentHealth("ingress-nginx", "app.kubernetes.io/name=ingress-nginx"))
                    .certManager(getComponentHealth("cert-manager", "app.kubernetes.io/name=cert-manager"))
                    .calicoNetwork(getComponentHealth("kube-system", "k8s-app=calico-node"))
                    .coredns(getComponentHealth("kube-system", "k8s-app=kube-dns"))
                    .loadBalancer(getLoadBalancerHealth())
                    .build();
        } catch (Exception e) {
            log.error("Failed to get K8s infrastructure health: {}", e.getMessage());
            return KubernetesInfrastructure.builder()
                    .ingressNginx(ComponentHealth.builder().status("ERROR").build())
                    .build();
        }
    }

    private ComponentHealth getComponentHealth(String namespace, String labelSelector) {
        try {
            V1PodList podList = coreV1Api.listNamespacedPod(
                    namespace, null, null, null, null, labelSelector,
                    null, null, null, null, null);

            List<PodInfo> pods = new ArrayList<>();
            int totalRestarts = 0;
            int readyCount = 0;

            for (V1Pod pod : podList.getItems()) {
                V1PodStatus status = pod.getStatus();
                String podName = pod.getMetadata().getName();
                boolean ready = isPodReady(status);
                int restarts = getPodRestarts(status);
                String age = getAge(pod.getMetadata().getCreationTimestamp());
                String node = pod.getSpec().getNodeName();

                if (ready)
                    readyCount++;
                totalRestarts += restarts;

                pods.add(PodInfo.builder()
                        .name(podName)
                        .status(status.getPhase())
                        .ready(ready)
                        .restarts(restarts)
                        .age(age)
                        .node(node)
                        .build());
            }

            String statusStr = readyCount == pods.size() ? "UP" : (readyCount > 0 ? "DEGRADED" : "DOWN");

            return ComponentHealth.builder()
                    .status(statusStr)
                    .readyReplicas(readyCount)
                    .totalReplicas(pods.size())
                    .restartCount(totalRestarts)
                    .pods(pods)
                    .build();
        } catch (ApiException e) {
            log.error("Failed to get component health for {}/{}: {}", namespace, labelSelector, e.getMessage());
            return ComponentHealth.builder()
                    .status("ERROR")
                    .build();
        }
    }

    private LoadBalancerHealth getLoadBalancerHealth() {
        try {
            V1Service svc = coreV1Api.readNamespacedService(
                    "ingress-nginx-controller", "ingress-nginx", null);

            V1ServiceStatus status = svc.getStatus();
            if (status != null && status.getLoadBalancer() != null &&
                    status.getLoadBalancer().getIngress() != null &&
                    !status.getLoadBalancer().getIngress().isEmpty()) {

                V1LoadBalancerIngress ingress = status.getLoadBalancer().getIngress().get(0);
                List<String> ports = svc.getSpec().getPorts().stream()
                        .map(p -> p.getPort() + "/" + p.getProtocol())
                        .collect(Collectors.toList());

                return LoadBalancerHealth.builder()
                        .status("ACTIVE")
                        .externalIp(ingress.getIp())
                        .hostname(ingress.getHostname())
                        .ports(ports)
                        .build();
            }
            return LoadBalancerHealth.builder().status("PENDING").build();
        } catch (ApiException e) {
            log.error("Failed to get LoadBalancer health: {}", e.getMessage());
            return LoadBalancerHealth.builder().status("ERROR").build();
        }
    }

    private List<Map<String, Object>> getPodsInNamespace(String namespace) throws ApiException {
        V1PodList podList = coreV1Api.listNamespacedPod(
                namespace, null, null, null, null, null,
                null, null, null, null, null);

        return podList.getItems().stream().map(pod -> {
            Map<String, Object> podInfo = new LinkedHashMap<>();
            podInfo.put("name", pod.getMetadata().getName());
            podInfo.put("status", pod.getStatus().getPhase());
            podInfo.put("ready", isPodReady(pod.getStatus()));
            podInfo.put("restarts", getPodRestarts(pod.getStatus()));
            podInfo.put("age", getAge(pod.getMetadata().getCreationTimestamp()));
            podInfo.put("node", pod.getSpec().getNodeName());
            return podInfo;
        }).collect(Collectors.toList());
    }

    private List<ServiceHealth> checkAllServices() {
        List<ServiceHealth> services = new ArrayList<>();

        services.add(createServiceHealth("auth-service", "/auth-service/actuator/health"));
        services.add(createServiceHealth("admin-core-service", "/admin-core-service/actuator/health"));
        services.add(createServiceHealth("media-service", "/media-service/actuator/health"));
        services.add(createServiceHealth("assessment-service", "/assessment-service/actuator/health"));
        services.add(createServiceHealth("notification-service", "/notification-service/actuator/health"));
        services.add(createServiceHealth("ai-service", "/ai-service/actuator/health"));

        // Add community-service (this service)
        services.add(ServiceHealth.builder()
                .name("community-service")
                .status("UP")
                .responseTimeMs(0L)
                .healthEndpoint("/community-service/actuator/health")
                .publicHealthEndpoint("/community-service/actuator/health")
                .lastCheck(Instant.now())
                .build());

        return services;
    }

    private ServiceHealth createServiceHealth(String name, String publicPath) {
        return ServiceHealth.builder()
                .name(name)
                .status("PENDING_CLIENT_CHECK")
                .responseTimeMs(null)
                .healthEndpoint(publicPath)
                .publicHealthEndpoint(publicPath)
                .lastCheck(Instant.now())
                .build();
    }

    private Map<String, Object> createQuickServiceConfig(String publicPath) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "CHECK_CLIENT_SIDE");
        result.put("public_endpoint", publicPath);
        return result;
    }

    private DependencyHealth checkDependencies() {
        return DependencyHealth.builder()
                .redis(checkRedisHealth())
                .postgresql(checkDatabaseHealth())
                .build();
    }

    private RedisHealth checkRedisHealth() {
        if (redisTemplate == null) {
            return RedisHealth.builder()
                    .status("UNAVAILABLE")
                    .connected(false)
                    .host(redisHost)
                    .port(redisPort)
                    .build();
        }

        try {
            long start = System.currentTimeMillis();
            String pong = redisTemplate.getConnectionFactory().getConnection().ping();
            long responseTime = System.currentTimeMillis() - start;

            return RedisHealth.builder()
                    .status("PONG".equals(pong) ? "UP" : "DOWN")
                    .connected(true)
                    .responseTimeMs(responseTime)
                    .host(redisHost)
                    .port(redisPort)
                    .build();
        } catch (Exception e) {
            return RedisHealth.builder()
                    .status("DOWN")
                    .connected(false)
                    .host(redisHost)
                    .port(redisPort)
                    .build();
        }
    }

    private DatabaseHealth checkDatabaseHealth() {
        try {
            long start = System.currentTimeMillis();
            try (Connection conn = dataSource.getConnection()) {
                boolean valid = conn.isValid(5);
                long responseTime = System.currentTimeMillis() - start;

                return DatabaseHealth.builder()
                        .status(valid ? "UP" : "DOWN")
                        .connected(valid)
                        .responseTimeMs(responseTime)
                        .databaseName(conn.getCatalog())
                        .build();
            }
        } catch (SQLException e) {
            return DatabaseHealth.builder()
                    .status("DOWN")
                    .connected(false)
                    .build();
        }
    }

    private Map<String, Object> checkRedisQuick() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("host", redisHost);

        if (redisTemplate == null) {
            result.put("status", "UNAVAILABLE");
            return result;
        }

        try {
            long start = System.currentTimeMillis();
            redisTemplate.getConnectionFactory().getConnection().ping();
            result.put("status", "UP");
            result.put("response_time_ms", System.currentTimeMillis() - start);
        } catch (Exception e) {
            result.put("status", "DOWN");
            result.put("error", e.getMessage());
        }
        return result;
    }

    private Map<String, Object> checkDatabaseQuick() {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            long start = System.currentTimeMillis();
            try (Connection conn = dataSource.getConnection()) {
                result.put("status", conn.isValid(5) ? "UP" : "DOWN");
                result.put("response_time_ms", System.currentTimeMillis() - start);
            }
        } catch (Exception e) {
            result.put("status", "DOWN");
            result.put("error", e.getMessage());
        }
        return result;
    }

    private List<ConnectivityCheck> checkConnectivity() {
        // Inter-service connectivity checks performed by backend are often misleading
        // or reflect internal cluster state rather than user-facing availability.
        // Returning empty list as requested to avoid confusion.
        return new ArrayList<>();
    }

    private List<KubernetesEvent> getRecentKubernetesEvents() {
        if (!k8sAvailable) {
            return Collections.emptyList();
        }

        try {
            // Get events from last hour, warnings only
            CoreV1EventList eventList = coreV1Api.listEventForAllNamespaces(
                    null, null, "type=Warning", null, null, null, null, null, null, null);

            return eventList.getItems().stream()
                    .sorted((a, b) -> {
                        OffsetDateTime aTime = a.getLastTimestamp() != null ? a.getLastTimestamp() : a.getEventTime();
                        OffsetDateTime bTime = b.getLastTimestamp() != null ? b.getLastTimestamp() : b.getEventTime();
                        if (aTime == null || bTime == null)
                            return 0;
                        return bTime.compareTo(aTime);
                    })
                    .limit(20)
                    .map(event -> KubernetesEvent.builder()
                            .type(event.getType())
                            .reason(event.getReason())
                            .message(event.getMessage())
                            .object(event.getInvolvedObject().getName())
                            .namespace(event.getInvolvedObject().getNamespace())
                            .timestamp(event.getLastTimestamp() != null ? event.getLastTimestamp().toInstant()
                                    : Instant.now())
                            .count(event.getCount() != null ? event.getCount() : 1)
                            .build())
                    .collect(Collectors.toList());
        } catch (ApiException e) {
            log.error("Failed to get K8s events: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    private String determineOverallStatus(KubernetesInfrastructure k8s, List<ServiceHealth> services,
            DependencyHealth deps, List<ConnectivityCheck> connectivity) {
        // Check if any critical component is down
        if (deps.getPostgresql() != null && !"UP".equals(deps.getPostgresql().getStatus())) {
            return "UNHEALTHY";
        }

        long downServices = services.stream()
                .filter(s -> "DOWN".equals(s.getStatus()))
                .count();

        if (downServices > 2)
            return "UNHEALTHY";
        if (downServices > 0)
            return "DEGRADED";

        long failedConnections = connectivity.stream()
                .filter(c -> "FAILED".equals(c.getStatus()))
                .count();

        if (failedConnections > 2)
            return "DEGRADED";

        return "HEALTHY";
    }

    private boolean isPodReady(V1PodStatus status) {
        if (status == null || status.getConditions() == null)
            return false;
        return status.getConditions().stream()
                .anyMatch(c -> "Ready".equals(c.getType()) && "True".equals(c.getStatus()));
    }

    private int getPodRestarts(V1PodStatus status) {
        if (status == null || status.getContainerStatuses() == null)
            return 0;
        return status.getContainerStatuses().stream()
                .mapToInt(V1ContainerStatus::getRestartCount)
                .sum();
    }

    private String getAge(OffsetDateTime creationTimestamp) {
        if (creationTimestamp == null)
            return "unknown";
        Duration duration = Duration.between(creationTimestamp.toInstant(), Instant.now());
        long days = duration.toDays();
        if (days > 0)
            return days + "d";
        long hours = duration.toHours();
        if (hours > 0)
            return hours + "h";
        return duration.toMinutes() + "m";
    }
}
