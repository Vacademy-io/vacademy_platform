package vacademy.io.admin_core_service.features.live_session.provider.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.provider.entity.AppConfig;
import vacademy.io.admin_core_service.features.live_session.provider.entity.BbbServerPool;
import vacademy.io.admin_core_service.features.live_session.provider.repository.AppConfigRepository;
import vacademy.io.admin_core_service.features.live_session.provider.repository.BbbServerPoolRepository;

import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * REST API for managing the BBB server pool.
 * Used by community_service scheduler and admin dashboards.
 *
 * Endpoints are NOT authenticated — called server-to-server.
 * If security is needed, add a secret header check.
 */
@RestController
@RequestMapping("/admin-core-service/bbb/pool")
@RequiredArgsConstructor
@Slf4j
public class BbbPoolController {

    private final BbbServerPoolRepository poolRepository;
    private final AppConfigRepository configRepository;

    // -----------------------------------------------------------------------
    // Pool listing
    // -----------------------------------------------------------------------

    /**
     * GET /admin-core-service/bbb/pool/servers
     * Returns all enabled servers ordered by priority.
     * Used by community_service to know which servers to start/stop.
     */
    @GetMapping("/servers")
    public ResponseEntity<List<BbbServerPool>> listEnabledServers() {
        return ResponseEntity.ok(poolRepository.findByEnabledTrueOrderByPriorityAsc());
    }

    /**
     * GET /admin-core-service/bbb/pool/servers/running
     * Returns only currently running servers.
     */
    @GetMapping("/servers/running")
    public ResponseEntity<List<BbbServerPool>> listRunningServers() {
        return ResponseEntity.ok(poolRepository.findByStatusAndEnabledTrue("RUNNING"));
    }

    // -----------------------------------------------------------------------
    // Config
    // -----------------------------------------------------------------------

    /**
     * GET /admin-core-service/bbb/pool/config/servers-to-start
     * Returns the number of servers to start on daily schedule.
     */
    @GetMapping("/config/servers-to-start")
    public ResponseEntity<Map<String, Object>> getServersToStart() {
        int count = configRepository.getIntConfig("bbb_servers_to_start", 1);
        return ResponseEntity.ok(Map.of("serversToStart", count));
    }

    /**
     * PUT /admin-core-service/bbb/pool/config/servers-to-start
     * Update how many servers to start.
     */
    @PutMapping("/config/servers-to-start")
    public ResponseEntity<Map<String, Object>> setServersToStart(@RequestBody Map<String, Object> body) {
        int count = ((Number) body.get("serversToStart")).intValue();
        AppConfig config = configRepository.findByConfigKey("bbb_servers_to_start")
                .orElse(AppConfig.builder()
                        .configKey("bbb_servers_to_start")
                        .description("Number of BBB servers to start on daily schedule")
                        .build());
        config.setConfigValue(String.valueOf(count));
        config.setUpdatedAt(new Date());
        configRepository.save(config);
        log.info("[BBB Pool] Updated servers_to_start to {}", count);
        return ResponseEntity.ok(Map.of("serversToStart", count));
    }

    // -----------------------------------------------------------------------
    // Server status updates (called by community_service after workflow)
    // -----------------------------------------------------------------------

    /**
     * POST /admin-core-service/bbb/pool/{slug}/status
     * Body: { "status": "RUNNING", "hetznerServerId": 12345 }
     *
     * Updates the status of a pool server after a workflow completes.
     */
    @PostMapping("/{slug}/status")
    public ResponseEntity<BbbServerPool> updateServerStatus(
            @PathVariable String slug,
            @RequestBody Map<String, Object> body) {
        BbbServerPool server = poolRepository.findBySlug(slug)
                .orElseThrow(() -> new vacademy.io.common.exceptions.VacademyException(
                        "Server not found: " + slug));

        String status = (String) body.get("status");
        if (status != null) {
            server.setStatus(status);
            // Reset active meetings when server stops
            if ("STOPPED".equals(status) || "ERROR".equals(status)) {
                server.setActiveMeetings(0);
                server.setHetznerServerId(null);
            }
        }

        if (body.containsKey("hetznerServerId")) {
            Object hetzId = body.get("hetznerServerId");
            server.setHetznerServerId(hetzId != null ? ((Number) hetzId).longValue() : null);
        }

        if (body.containsKey("healthStatus")) {
            server.setHealthStatus((String) body.get("healthStatus"));
            server.setLastHealthCheck(new Date());
        }

        server.setUpdatedAt(new Date());
        poolRepository.save(server);

        log.info("[BBB Pool] Updated server {} status to {}", slug, status);
        return ResponseEntity.ok(server);
    }

    // -----------------------------------------------------------------------
    // Pool server CRUD (for admin UI)
    // -----------------------------------------------------------------------

    /**
     * PUT /admin-core-service/bbb/pool/{slug}/max-meetings
     * Body: { "maxMeetings": 5 }
     */
    @PutMapping("/{slug}/max-meetings")
    public ResponseEntity<BbbServerPool> updateMaxMeetings(
            @PathVariable String slug,
            @RequestBody Map<String, Object> body) {
        BbbServerPool server = poolRepository.findBySlug(slug)
                .orElseThrow(() -> new vacademy.io.common.exceptions.VacademyException(
                        "Server not found: " + slug));
        server.setMaxMeetings(((Number) body.get("maxMeetings")).intValue());
        server.setUpdatedAt(new Date());
        poolRepository.save(server);
        log.info("[BBB Pool] Updated max_meetings for {} to {}", slug, server.getMaxMeetings());
        return ResponseEntity.ok(server);
    }
}
