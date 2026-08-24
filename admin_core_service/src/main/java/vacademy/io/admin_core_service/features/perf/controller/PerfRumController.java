package vacademy.io.admin_core_service.features.perf.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.perf.dto.PerfRumReportDTO;
import vacademy.io.admin_core_service.features.perf.service.PerfRumService;

/**
 * Ingest for real-user latency summaries from admin browsers.
 *
 * Authenticated (it is deliberately NOT in ApplicationSecurityConfig's ALLOWED_PATHS)
 * so the platform's own telemetry cannot be filled with noise by anyone who finds the
 * URL. The institute label comes from the caller-supplied `clientId` header, which the
 * admin dashboard's axios instance already attaches — that makes it telemetry-grade
 * attribution, not a security boundary, and nothing sensitive is keyed off it.
 *
 * Returns 202 and does no database work on this path: the payload goes into an
 * in-memory buffer that PerfRumService flushes once a minute. A user who is already
 * having a slow time must not be made to wait on the machinery that measures it.
 *
 * Note the path avoids the substring "internal" — InternalAuthFilter 401s any URI
 * containing it that lacks clientName + Signature headers.
 */
@RestController
@RequestMapping("/admin-core-service/v1/perf")
@RequiredArgsConstructor
@Slf4j
public class PerfRumController {

    private final PerfRumService perfRumService;

    @PostMapping("/rum")
    public ResponseEntity<Void> report(
            @RequestBody PerfRumReportDTO report,
            @RequestHeader(value = "clientId", required = false) String instituteId) {
        try {
            perfRumService.record(instituteId, report);
        } catch (Exception e) {
            // Never surface a telemetry failure to the user's browser.
            log.debug("[perf-rum] ingest failed: {}", e.getMessage());
        }
        return ResponseEntity.accepted().build();
    }
}
