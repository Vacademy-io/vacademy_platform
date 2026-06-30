package vacademy.io.admin_core_service.features.call_intelligence.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.call_intelligence.core.CallIntelligenceEnqueueService;
import vacademy.io.admin_core_service.features.call_intelligence.core.CallIntelligenceQueryService;
import vacademy.io.admin_core_service.features.call_intelligence.dto.CallIntelligenceAnalyticsDto;
import vacademy.io.admin_core_service.features.call_intelligence.dto.CallIntelligenceDto;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;

/**
 * Read APIs for Call Intelligence: per-call detail, per-lead history, and the
 * per-counsellor / per-team roll-ups behind the dashboards. Team scope is derived
 * from the acting user's reporting line, so a sales head only sees their own team.
 */
@RestController
@RequestMapping("/admin-core-service/call-intelligence")
@RequiredArgsConstructor
public class CallIntelligenceController {

    private final CallIntelligenceQueryService queryService;
    private final CallIntelligenceEnqueueService enqueueService;

    /** Intelligence for a single call (by the universal call_log id). */
    @GetMapping("/call/{callLogId}")
    public ResponseEntity<CallIntelligenceDto> getByCall(@PathVariable String callLogId) {
        return queryService.getByCallLogId(callLogId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * On-demand (re)analysis for a call: queues it for transcription + analysis now,
     * bypassing the source/min-duration gates (the user asked for this specific call).
     * Used by the panel's "Analyze" / "Re-analyze" action for old or failed calls.
     */
    @PostMapping("/call/{callLogId}/analyze")
    public ResponseEntity<Map<String, String>> analyze(@PathVariable String callLogId) {
        String result = enqueueService.triggerManual(callLogId);
        return switch (result) {
            case "QUEUED" -> ResponseEntity.ok(Map.of("status", "QUEUED"));
            case "NOT_FOUND" -> ResponseEntity.notFound().build();
            // 409: a recording is required, or the feature is off for this institute.
            default -> ResponseEntity.status(409).body(Map.of("status", result));
        };
    }

    /** All analyzed calls for a lead (one lead, possibly many counsellors/attempts). */
    @GetMapping("/lead/{responseId}")
    public ResponseEntity<List<CallIntelligenceDto>> getByLead(@PathVariable String responseId) {
        return ResponseEntity.ok(queryService.getByResponseId(responseId));
    }

    /** Roll-up for one counsellor over a date window (defaults to last 30 days). */
    @GetMapping("/analytics/counsellor")
    public ResponseEntity<CallIntelligenceAnalyticsDto> counsellorAnalytics(
            @RequestParam(value = "counsellorUserId", required = false) String counsellorUserId,
            @RequestParam(value = "from", required = false) Long fromMillis,
            @RequestParam(value = "to", required = false) Long toMillis,
            @RequestAttribute("user") CustomUserDetails user) {
        // Default to the acting user when no counsellor is specified ("my calls").
        String target = (counsellorUserId != null && !counsellorUserId.isBlank())
                ? counsellorUserId : (user == null ? null : user.getUserId());
        return ResponseEntity.ok(queryService.counsellorAnalytics(target, fromMillis, toMillis));
    }

    /** Roll-up for the acting user's whole team (sales-head view). */
    @GetMapping("/analytics/team")
    public ResponseEntity<CallIntelligenceAnalyticsDto> teamAnalytics(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "from", required = false) Long fromMillis,
            @RequestParam(value = "to", required = false) Long toMillis,
            @RequestAttribute("user") CustomUserDetails user) {
        String callerUserId = user == null ? null : user.getUserId();
        return ResponseEntity.ok(queryService.teamAnalytics(instituteId, callerUserId, fromMillis, toMillis));
    }
}
