package vacademy.io.community_service.feature.bbb;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * BBB Server Pool Management API.
 *
 * Health check:
 *   POST /community-service/bbb/health-check
 *
 * Trigger GitHub Actions (start/stop server pool):
 *   POST /community-service/bbb/server?action=start
 *   POST /community-service/bbb/server?action=stop
 *
 * Pool-aware actions:
 *   POST /community-service/bbb/pool/action
 *     ?action=start&serverSlug=all&serverCount=2
 */
@RestController
@RequestMapping("/community-service/bbb")
@RequiredArgsConstructor
public class BbbHealthCheckController {

    private final BbbHealthCheckService healthCheckService;

    @PostMapping("/health-check")
    public ResponseEntity<Map<String, Object>> triggerHealthCheck() {
        return ResponseEntity.ok(healthCheckService.runHealthCheck());
    }

    /** Legacy endpoint — backward compatible */
    @PostMapping("/server")
    public ResponseEntity<Map<String, Object>> triggerServerAction(
            @RequestParam String action) {
        return ResponseEntity.ok(healthCheckService.triggerGitHubAction(action));
    }

    /**
     * Pool-aware action dispatch.
     *
     * POST /community-service/bbb/pool/action
     *   ?action=start&serverSlug=all&serverCount=2
     *   ?action=stop&serverSlug=all
     *   ?action=start&serverSlug=bbb-pool-2
     */
    @PostMapping("/pool/action")
    public ResponseEntity<Map<String, Object>> triggerPoolAction(
            @RequestParam String action,
            @RequestParam(defaultValue = "all") String serverSlug,
            @RequestParam(defaultValue = "1") int serverCount) {
        return ResponseEntity.ok(
                healthCheckService.triggerPoolAction(action, serverSlug, serverCount));
    }
}
