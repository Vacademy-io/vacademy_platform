package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.telephony.queue.AiCallQueueSnapshotService;
import vacademy.io.admin_core_service.features.telephony.queue.dto.AiCallQueueDTOs.QueueSnapshot;

/**
 * The AI call queue as one machine-readable payload, for the Vacademy Health dashboard's
 * calls-queue page.
 *
 * <pre>
 *   GET /admin-core-service/internal/ai-queue/snapshot?limit=50[&instituteId=]
 * </pre>
 *
 * <h3>Why this is an {@code /internal/} route and not another super-admin one</h3>
 * The health dashboard is a separate service, not a person with a browser session. The
 * super-admin endpoints authenticate a {@code CustomUserDetails} off the request, which a
 * daemon has no way to present without impersonating someone. Any path containing
 * {@code internal} is instead matched by {@code InternalAuthFilter} and authenticated with
 * the {@code clientName} + {@code Signature} header pair against {@code client_secret_key}
 * — the same mechanism the voice bot already uses to call back into admin-core. So the
 * health dashboard gets its own credential that can be rotated or revoked on its own,
 * rather than a borrowed human one.
 *
 * <h3>Read-only, and cheap enough to poll</h3>
 * There is nothing to mutate here — capacity and lane changes stay on the super-admin
 * controller, where they are attributable to a person. The response is bounded: lanes are
 * only institutes that have work or an override, and {@code limit} is capped server-side,
 * so the payload cannot grow with the backlog. {@code waitingTotal} carries the real depth
 * regardless of how many rows come back.
 */
@RestController
@RequestMapping("/admin-core-service/internal/ai-queue")
@RequiredArgsConstructor
public class AiCallQueueInternalController {

    /** Rows returned when the caller does not say. Enough to fill a screen. */
    private static final int DEFAULT_LIMIT = 50;

    private final AiCallQueueSnapshotService snapshotService;

    /**
     * Everything at once: fleet capacity and per-box health, a row per institute holding
     * or waiting for lines, the head of the queue in dial order with institute and agent
     * names resolved, and fleet-wide totals per state.
     *
     * @param limit waiting calls to include (0 = capacity + lanes only). Capped server-side.
     * @param instituteId optional — narrows the waiting list only; capacity and lanes stay
     *                    fleet-wide, since a lane's share is meaningless in isolation.
     */
    @GetMapping("/snapshot")
    public ResponseEntity<QueueSnapshot> snapshot(
            @RequestParam(value = "limit", defaultValue = "" + DEFAULT_LIMIT) int limit,
            @RequestParam(value = "instituteId", required = false) String instituteId) {
        return ResponseEntity.ok(snapshotService.snapshot(Math.max(0, limit), instituteId));
    }
}
