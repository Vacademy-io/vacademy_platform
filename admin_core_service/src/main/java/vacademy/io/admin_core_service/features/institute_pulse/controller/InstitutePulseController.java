package vacademy.io.admin_core_service.features.institute_pulse.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.institute_pulse.dto.InstituteContentMapResponse;
import vacademy.io.admin_core_service.features.institute_pulse.dto.InstituteLiveClassesResponse;
import vacademy.io.admin_core_service.features.institute_pulse.dto.InstitutePulseFeedResponse;
import vacademy.io.admin_core_service.features.institute_pulse.dto.InstitutePulseSummaryResponse;
import vacademy.io.admin_core_service.features.institute_pulse.service.InstitutePulseService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Institute Pulse — institute-wide live view. Read-only; the frontend polls these on a ~30s
 * interval for one institute.
 *
 * <p><b>One endpoint per rail, deliberately not one aggregate.</b> The assessment rail lives in
 * assessment_service and is called directly by the frontend
 * ({@code GET /assessment-service/institute-pulse/summary}). Folding it in here would put its
 * latency and failure mode — against a 5-connection pool — in front of content and live classes
 * too. Separate endpoints give independent failure domains and per-rail cache TTLs.
 */
@RestController
@RequestMapping("/admin-core-service/institute-pulse")
@RequiredArgsConstructor
public class InstitutePulseController {

    private final InstitutePulseService institutePulseService;

    /**
     * Institute-wide presence KPIs + one page of the needs-attention-ordered roster.
     *
     * <p>{@code counts} and {@code totalPresent} are institute-wide window aggregates, not page
     * sums, so the KPI strip stays correct on any page.
     *
     * @param page  0-based roster page
     * @param limit learners per page; defaults and a hard ceiling applied server-side
     */
    @GetMapping("/summary")
    public ResponseEntity<InstitutePulseSummaryResponse> getSummary(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "packageSessionId", required = false) String packageSessionId,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(institutePulseService.getSummary(instituteId, packageSessionId, page, limit));
    }

    /** Where the institute is right now: course → subject → module → chapter → slide. */
    @GetMapping("/content-map")
    public ResponseEntity<InstituteContentMapResponse> getContentMap(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "packageSessionId", required = false) String packageSessionId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(institutePulseService.getContentMap(instituteId, packageSessionId));
    }

    /** On-air classes with turnout, plus the next-60-minutes strip. */
    @GetMapping("/live-classes")
    public ResponseEntity<InstituteLiveClassesResponse> getLiveClasses(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "packageSessionId", required = false) String packageSessionId,
            @RequestParam(value = "onAirPage", required = false) Integer onAirPage,
            @RequestParam(value = "upcomingPage", required = false) Integer upcomingPage,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(
                institutePulseService.getLiveClasses(instituteId, packageSessionId, onAirPage, upcomingPage));
    }

    /** Institute-wide live feed: content events and live-class joins, interleaved. */
    @GetMapping("/feed")
    public ResponseEntity<InstitutePulseFeedResponse> getFeed(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "packageSessionId", required = false) String packageSessionId,
            @RequestParam(value = "windowMinutes", required = false) Integer windowMinutes,
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(institutePulseService.getFeed(instituteId, packageSessionId, windowMinutes, limit));
    }
}
