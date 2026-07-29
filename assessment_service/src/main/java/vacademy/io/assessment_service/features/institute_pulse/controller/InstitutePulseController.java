package vacademy.io.assessment_service.features.institute_pulse.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.assessment_service.features.institute_pulse.dto.InstitutePulseSummaryResponse;
import vacademy.io.assessment_service.features.institute_pulse.service.InstitutePulseService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Institute Pulse — the assessment rail.
 *
 * <p>Called DIRECTLY by the admin dashboard, not proxied through admin_core_service. The frontend
 * already reaches this service the same way for ~60 other endpoints (single {@code BACKEND_BASE_URL}
 * with path routing, one JWT), so this needs no new host, CORS rule, or auth story — and it keeps
 * the cache at the source, where it can actually defend this service's 5-connection pool from
 * every caller rather than one replica of one caller.
 *
 * <p>Read-only. The frontend polls this on a ~30s interval for one institute; the service caches
 * per-institute for 30s so N admins cost the same as one.
 */
@RestController
@RequestMapping("/assessment-service/institute-pulse")
@RequiredArgsConstructor
public class InstitutePulseController {

    private final InstitutePulseService institutePulseService;

    /**
     * One page of live-assessment funnels, institute-wide totals, and — on page 0 only — the
     * in-flight risk list, recent submissions and results pipeline.
     *
     * <p>Assessments are paged because an institute can have many running at once and each one
     * costs a per-registration aggregation. {@code totals} stays institute-wide regardless of
     * page, so the KPI strip never silently degrades to "page 1 only".
     *
     * @param instituteId institute whose assessments to report on
     * @param page        0-based page of live assessments, ordered soonest-to-end
     * @param limit       assessments per page; defaults and a hard ceiling applied server-side
     */
    @GetMapping("/summary")
    public ResponseEntity<InstitutePulseSummaryResponse> getSummary(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "batchId", required = false) String batchId,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(institutePulseService.getSummary(instituteId, batchId, page, limit));
    }
}
