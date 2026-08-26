package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.telephony.queue.AiCallQueueService;
import vacademy.io.admin_core_service.features.telephony.queue.dto.AiCallQueueDTOs.QueueItemView;
import vacademy.io.admin_core_service.features.telephony.queue.dto.AiCallQueueDTOs.QueueSummary;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Map;

/**
 * An institute's own view of the AI call queue: what is waiting, how long it will take,
 * and the ability to call it off.
 *
 * <p>Read and cancel only, and it discloses no capacity figures. How many lines the
 * fleet has, and how many an institute may hold, are internal operating facts that live
 * on the super-admin and internal endpoints — an institute does not need to know it is
 * sharing a small pool, only how long its own calls will wait.
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/ai-queue")
@RequiredArgsConstructor
public class AiCallQueueController {

    private final AiCallQueueService queueService;
    private final InstituteAccessValidator instituteAccessValidator;

    /** Paged queue rows. {@code status} filters to one lifecycle state (e.g. QUEUED). */
    @GetMapping
    public ResponseEntity<Page<QueueItemView>> list(
            @RequestParam String instituteId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "25") int size,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(queueService.list(instituteId, status, page, size));
    }

    /** Depth, in-flight, the lane's share of the fleet, and a rough time-to-clear. */
    @GetMapping("/summary")
    public ResponseEntity<QueueSummary> summary(
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(queueService.summary(instituteId));
    }

    /** Queue-side counts for one bulk run, for the campaign progress dialog. */
    @GetMapping("/bulk-run")
    public ResponseEntity<Map<String, Long>> bulkRun(
            @RequestParam String instituteId,
            @RequestParam String audienceId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(queueService.bulkRunCounts(instituteId, audienceId));
    }

    @Data
    public static class CancelBody {
        /** Optional: cancel only one bulk run's items (the audience id it was started from). */
        private String sourceRef;
        private String reason;
    }

    /**
     * Cancel everything this institute still has waiting — optionally narrowed to one
     * bulk run. Only QUEUED items are affected: a call already dialling is not something
     * this can take back.
     */
    @PostMapping("/cancel")
    public ResponseEntity<Map<String, Object>> cancel(
            @RequestParam String instituteId,
            @RequestBody(required = false) CancelBody body,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        int cancelled = queueService.cancelForInstitute(instituteId,
                body == null ? null : body.getSourceRef(),
                body == null ? null : body.getReason());
        return ResponseEntity.ok(Map.of("cancelled", cancelled));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> cancelOne(
            @PathVariable String id,
            @RequestParam String instituteId,
            @RequestParam(value = "reason", required = false) String reason,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        boolean cancelled = queueService.cancelOne(instituteId, id, reason);
        return ResponseEntity.ok(Map.of("cancelled", cancelled));
    }
}
