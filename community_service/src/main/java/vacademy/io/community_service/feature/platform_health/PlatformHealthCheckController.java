package vacademy.io.community_service.feature.platform_health;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * External uptime monitor API for per-client deployments.
 *
 * <pre>
 *   GET  /community-service/platform-health/status          (open)
 *        Cached view of the last scheduled run. Does not probe.
 *
 *   POST /community-service/platform-health/check[?notify=false]          (auth required)
 *        Probes every configured deployment now.
 *
 *   POST /community-service/platform-health/check/{name}[?notify=false]   (auth required)
 *        Probes a single deployment, e.g. "veted".
 * </pre>
 *
 * <p>Only {@code /status} is allow-listed in the security config; the POST
 * endpoints require authentication because they trigger live probes and can send
 * WhatsApp pages. {@code notify} additionally defaults to <b>false</b> as a second
 * layer, so an authenticated caller has to opt in explicitly to page anyone. The
 * scheduled run always passes true — that is the real paging path.</p>
 *
 * <p>With {@code notify=false} the check is strictly read-only: it probes and
 * reports, but does not advance the alerting state machine (the response carries
 * {@code stateCommitted: false}). That matters because this endpoint is open — if
 * a manual check could move the recorded state, anyone calling it during an outage
 * would consume the UP→DOWN transition without a page being sent, and the next
 * scheduled run would see no change and stay silent. The outage would never be
 * reported.</p>
 */
@RestController
@RequestMapping("/community-service/platform-health")
@RequiredArgsConstructor
public class PlatformHealthCheckController {

    private final PlatformHealthCheckService service;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(service.lastKnownStatus());
    }

    @PostMapping("/check")
    public ResponseEntity<Map<String, Object>> checkAll(
            @RequestParam(defaultValue = "false") boolean notify) {
        return ResponseEntity.ok(service.runAll(notify));
    }

    @PostMapping("/check/{name}")
    public ResponseEntity<Map<String, Object>> checkOne(
            @org.springframework.web.bind.annotation.PathVariable String name,
            @RequestParam(defaultValue = "false") boolean notify) {
        return ResponseEntity.ok(service.runTargetByName(name, notify));
    }
}
