package vacademy.io.community_service.feature.bbb;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * BBB Server Management API.
 *
 * Health check:
 *   POST /community-service/bbb/health-check
 *
 * Trigger GitHub Actions (start/stop server):
 *   POST /community-service/bbb/server?action=start
 *   POST /community-service/bbb/server?action=stop
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

    @PostMapping("/server")
    public ResponseEntity<Map<String, Object>> triggerServerAction(
            @RequestParam String action) {
        return ResponseEntity.ok(healthCheckService.triggerGitHubAction(action));
    }
}
