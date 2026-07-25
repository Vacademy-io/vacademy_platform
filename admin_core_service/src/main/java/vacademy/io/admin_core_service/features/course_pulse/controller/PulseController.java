package vacademy.io.admin_core_service.features.course_pulse.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.course_pulse.dto.ContentMapResponse;
import vacademy.io.admin_core_service.features.course_pulse.dto.PulseFeedResponse;
import vacademy.io.admin_core_service.features.course_pulse.dto.PulseSummaryResponse;
import vacademy.io.admin_core_service.features.course_pulse.service.PulseService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Course Pulse — live teacher view. Phase 1: the Roster/summary poll.
 * Read-only; the frontend polls this on a ~15s interval for one batch.
 */
@RestController
@RequestMapping("/admin-core-service/course-pulse")
@RequiredArgsConstructor
public class PulseController {

    private final PulseService pulseService;

    /**
     * Live KPI counts + capped, needs-attention-ordered roster for one batch.
     *
     * @param batchId package_session id of the batch being viewed
     * @param limit   optional roster row cap (defaults + hard-ceiling applied server-side)
     */
    @GetMapping("/summary")
    public ResponseEntity<PulseSummaryResponse> getSummary(
            @RequestParam("batchId") String batchId,
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(pulseService.getSummary(batchId, limit, user));
    }

    /**
     * Content Map: where the batch is right now, as a subject → module → chapter → slide
     * tree of only the active branches, head counts rolled up.
     */
    @GetMapping("/content-map")
    public ResponseEntity<ContentMapResponse> getContentMap(
            @RequestParam("batchId") String batchId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(pulseService.getContentMap(batchId, user));
    }

    /**
     * Live Feed: recent submission/attempt events for the batch, newest first.
     *
     * @param windowMinutes optional lookback window (defaults + hard-ceiling applied server-side)
     */
    @GetMapping("/feed")
    public ResponseEntity<PulseFeedResponse> getFeed(
            @RequestParam("batchId") String batchId,
            @RequestParam(value = "windowMinutes", required = false) Integer windowMinutes,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(pulseService.getFeed(batchId, windowMinutes, user));
    }
}
