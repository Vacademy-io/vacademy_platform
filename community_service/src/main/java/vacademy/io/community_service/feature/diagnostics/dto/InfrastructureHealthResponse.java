package vacademy.io.community_service.feature.diagnostics.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Complete infrastructure health response DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InfrastructureHealthResponse {

    @JsonProperty("timestamp")
    private Instant timestamp;

    @JsonProperty("overall_status")
    private String overallStatus; // HEALTHY, DEGRADED, UNHEALTHY

    @JsonProperty("kubernetes_infrastructure")
    private KubernetesInfrastructure kubernetesInfrastructure;

    @JsonProperty("application_services")
    private List<ServiceHealth> applicationServices;

    @JsonProperty("dependencies")
    private DependencyHealth dependencies;

    @JsonProperty("connectivity_matrix")
    private List<ConnectivityCheck> connectivityMatrix;

    @JsonProperty("recent_events")
    private List<KubernetesEvent> recentEvents;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KubernetesInfrastructure {

        @JsonProperty("ingress_nginx")
        private ComponentHealth ingressNginx;

        @JsonProperty("cert_manager")
        private ComponentHealth certManager;

        @JsonProperty("load_balancer")
        private LoadBalancerHealth loadBalancer;

        @JsonProperty("calico_network")
        private ComponentHealth calicoNetwork;

        @JsonProperty("coredns")
        private ComponentHealth coredns;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ComponentHealth {

        @JsonProperty("status")
        private String status; // UP, DOWN, DEGRADED

        @JsonProperty("ready_replicas")
        private int readyReplicas;

        @JsonProperty("total_replicas")
        private int totalReplicas;

        @JsonProperty("restart_count")
        private int restartCount;

        @JsonProperty("last_restart")
        private String lastRestart;

        @JsonProperty("pods")
        private List<PodInfo> pods;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PodInfo {

        @JsonProperty("name")
        private String name;

        @JsonProperty("status")
        private String status;

        @JsonProperty("ready")
        private boolean ready;

        @JsonProperty("restarts")
        private int restarts;

        @JsonProperty("age")
        private String age;

        @JsonProperty("node")
        private String node;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoadBalancerHealth {

        @JsonProperty("status")
        private String status;

        @JsonProperty("external_ip")
        private String externalIp;

        @JsonProperty("hostname")
        private String hostname;

        @JsonProperty("ports")
        private List<String> ports;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceHealth {

        @JsonProperty("name")
        private String name;

        @JsonProperty("status")
        private String status;

        @JsonProperty("ready_replicas")
        private int readyReplicas;

        @JsonProperty("total_replicas")
        private int totalReplicas;

        @JsonProperty("restart_count")
        private int restartCount;

        @JsonProperty("response_time_ms")
        private Long responseTimeMs;

        @JsonProperty("health_endpoint")
        private String healthEndpoint;

        @JsonProperty("last_check")
        private Instant lastCheck;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DependencyHealth {

        @JsonProperty("redis")
        private RedisHealth redis;

        @JsonProperty("postgresql")
        private DatabaseHealth postgresql;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RedisHealth {

        @JsonProperty("status")
        private String status;

        @JsonProperty("connected")
        private boolean connected;

        @JsonProperty("response_time_ms")
        private Long responseTimeMs;

        @JsonProperty("host")
        private String host;

        @JsonProperty("port")
        private int port;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DatabaseHealth {

        @JsonProperty("status")
        private String status;

        @JsonProperty("connected")
        private boolean connected;

        @JsonProperty("response_time_ms")
        private Long responseTimeMs;

        @JsonProperty("active_connections")
        private int activeConnections;

        @JsonProperty("database_name")
        private String databaseName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConnectivityCheck {

        @JsonProperty("source")
        private String source;

        @JsonProperty("target")
        private String target;

        @JsonProperty("status")
        private String status; // OK, FAILED, TIMEOUT

        @JsonProperty("response_time_ms")
        private Long responseTimeMs;

        @JsonProperty("last_check")
        private Instant lastCheck;

        @JsonProperty("error_message")
        private String errorMessage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KubernetesEvent {

        @JsonProperty("type")
        private String type; // Normal, Warning

        @JsonProperty("reason")
        private String reason;

        @JsonProperty("message")
        private String message;

        @JsonProperty("object")
        private String object;

        @JsonProperty("namespace")
        private String namespace;

        @JsonProperty("timestamp")
        private Instant timestamp;

        @JsonProperty("count")
        private int count;
    }
}
