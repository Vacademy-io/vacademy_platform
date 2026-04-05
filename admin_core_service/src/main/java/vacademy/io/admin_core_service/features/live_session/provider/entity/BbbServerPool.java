package vacademy.io.admin_core_service.features.live_session.provider.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

/**
 * Represents a BBB server in the pool.
 * Each row maps to a physical Hetzner server with its own domain, snapshot chain,
 * API credentials, and meeting capacity.
 *
 * Meeting routing: new meetings are assigned to the first server (by priority)
 * that has available capacity (active_meetings < max_meetings) and is RUNNING.
 */
@Entity
@Table(name = "bbb_server_pool")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BbbServerPool {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    /** Unique human-readable identifier: "bbb-pool-1", "bbb-pool-2" */
    @Column(name = "slug", nullable = false, unique = true, length = 30)
    private String slug;

    /** Lower = start first, fill first. Server with priority=1 is the primary. */
    @Column(name = "priority", nullable = false)
    private Integer priority;

    /** Hetzner server type: "ccx33", "cpx42", "cpx52" */
    @Column(name = "server_type", nullable = false, length = 20)
    private String serverType;

    /** Hetzner server name (used for API lookups): "vacademy-bbb-1" */
    @Column(name = "server_name", nullable = false, length = 50)
    private String serverName;

    /** Public domain for this server: "meet.vacademy.io", "meet2.vacademy.io" */
    @Column(name = "domain", nullable = false, length = 100)
    private String domain;

    /** BBB API URL: "https://meet.vacademy.io/bigbluebutton/api" */
    @Column(name = "api_url", length = 255)
    private String apiUrl;

    /** BBB shared secret for API authentication */
    @Column(name = "secret", length = 255)
    @JsonIgnore
    private String secret;

    /** Hetzner server ID (null when server is deleted/stopped) */
    @Column(name = "hetzner_server_id")
    private Long hetznerServerId;

    /** Snapshot description label for this server: "vacademy-bbb-pool-1" */
    @Column(name = "snapshot_desc", nullable = false, length = 100)
    private String snapshotDesc;

    /** Hetzner datacenter location */
    @Column(name = "location", length = 10)
    @Builder.Default
    private String location = "sin";

    /** Maximum concurrent meetings allowed on this server */
    @Column(name = "max_meetings", nullable = false)
    @Builder.Default
    private Integer maxMeetings = 5;

    /** Currently running meetings count */
    @Column(name = "active_meetings", nullable = false)
    @Builder.Default
    private Integer activeMeetings = 0;

    /** Server lifecycle status: STOPPED, STARTING, RUNNING, STOPPING, ERROR */
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "STOPPED";

    /** Health check result: HEALTHY, DEGRADED, DOWN, UNKNOWN */
    @Column(name = "health_status", length = 20)
    @Builder.Default
    private String healthStatus = "UNKNOWN";

    @Column(name = "last_health_check")
    private Date lastHealthCheck;

    /** When false, this server is skipped for start/stop/routing */
    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at")
    private Date updatedAt;

    // ── Convenience methods ─────────────────────────────────────────

    public boolean hasCapacity() {
        return activeMeetings < maxMeetings;
    }

    public boolean isRunning() {
        return "RUNNING".equals(status);
    }

    public boolean isAvailable() {
        return isRunning() && hasCapacity() && Boolean.TRUE.equals(enabled);
    }
}
