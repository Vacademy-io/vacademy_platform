package vacademy.io.admin_core_service.features.reporting.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.reporting.dto.ReportScheduleConfig;
import vacademy.io.admin_core_service.features.reporting.entity.ReportRun;
import vacademy.io.admin_core_service.features.reporting.entity.ReportRunRecipient;
import vacademy.io.admin_core_service.features.reporting.repository.ReportRunRecipientRepository;
import vacademy.io.admin_core_service.features.reporting.repository.ReportRunRepository;
import vacademy.io.admin_core_service.features.reporting.service.ReportRunService;
import vacademy.io.admin_core_service.features.reporting.service.ReportBillingService;
import vacademy.io.admin_core_service.features.reporting.service.ReportRecipientResolver;
import vacademy.io.admin_core_service.features.reporting.service.ReportingScopeResolver;
import vacademy.io.admin_core_service.features.reporting.spi.ReportSection;
import vacademy.io.admin_core_service.features.reporting.spi.ReportSectionRegistry;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Admin surface for scheduled reporting.
 *
 * The schedule configuration itself is NOT here — it rides on the generic
 * institute-settings endpoints under the REPORT_SETTING key, so there is one
 * save/get path for every setting on the platform. What this controller adds is
 * the three things the configuration screen cannot work out for itself.
 *
 *   GET /reporting/v1/sections        which sections this institute can populate
 *   POST /reporting/v1/scope-preview  how many documents a schedule would produce
 *   GET /reporting/v1/runs            delivery history
 *   GET /reporting/v1/runs/{id}/recipients   who received a given report
 *
 * Institute comes from the clientId header, matching the AI-usage and audit-log
 * controllers.
 */
@RestController
@RequestMapping("/admin-core-service/reporting/v1")
@RequiredArgsConstructor
public class ReportingController {

    private final ReportSectionRegistry registry;
    private final ReportingScopeResolver scopeResolver;
    private final ReportRunRepository runRepository;
    private final ReportRunRecipientRepository recipientRepository;
    private final ReportRunService runService;
    private final InstituteAccessValidator instituteAccessValidator;
    private final ReportRecipientResolver recipientResolver;
    private final ReportBillingService billing;

    /**
     * Sections offered to this institute, each flagged with whether it has data.
     *
     * Institutes have very different shapes — one runs 1,573 live sessions and no
     * chatbot, another has 66,947 progress rows and one live session. Presenting
     * every section to everyone produces a config screen full of choices that can
     * only ever render empty, so the screen shows availability and pre-selects
     * what is live. Configuration becomes confirmation.
     */
    @GetMapping("/sections")
    public ResponseEntity<List<Map<String, Object>>> listSections(HttpServletRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        String instituteId = requireInstituteId(request, user);
        List<Map<String, Object>> out = new ArrayList<>();
        for (ReportSection s : registry.all()) {
            boolean available;
            try {
                available = s.isAvailableFor(instituteId);
            } catch (Exception e) {
                available = false; // a failing probe hides the section, never blanks the page
            }
            out.add(Map.of(
                    "key", s.key(),
                    "title", s.title(),
                    "description", s.description(),
                    "visibleToRoles", s.visibleToRoles(),
                    "identifying", s.identifying(),
                    "creditWeight", s.creditWeight(),
                    "available", available));
        }
        return ResponseEntity.ok(out);
    }

    /**
     * The batches / subjects / faculty a schedule can name.
     *
     * An empty scopeIds means "all of them", which at a real institute is 661
     * documents — past the per-run cap, so such a schedule throws instead of
     * sending. This endpoint is what lets an admin pick a handful instead, which is
     * the difference between scoped reports working and being theoretical.
     */
    @GetMapping("/scope-options")
    public ResponseEntity<ReportingScopeResolver.Options> scopeOptions(HttpServletRequest request,
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String scopeType,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "50") int limit) {
        String instituteId = requireInstituteId(request, user);
        return ResponseEntity.ok(scopeResolver.options(instituteId, scopeType, q, limit));
    }

    /**
     * People who can be named as recipients — platform users of this institute only.
     *
     * Role-only targeting made a careful first send impossible: there was no way to
     * address a report to one person and check it before it reached eleven admins.
     */
    @GetMapping("/recipient-options")
    public ResponseEntity<List<ReportRecipientResolver.Candidate>> recipientOptions(
            HttpServletRequest request,
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "50") int limit) {
        String instituteId = requireInstituteId(request, user);
        return ResponseEntity.ok(recipientResolver.candidates(instituteId, q, limit));
    }

    /**
     * How many documents a schedule would actually generate — the fan-out guard.
     *
     * Call this before saving. Scope multiplies everything: at one production
     * institute "every batch" resolves to 661 documents and "every subject" to
     * 1,042. Daily, that is tens of thousands of generations a month, and under
     * per-report pricing every one of them bills. The admin has to be shown that
     * number before they commit to it, not discover it on the ledger.
     */
    @PostMapping("/scope-preview")
    public ResponseEntity<ReportingScopeResolver.Preview> previewScope(
            HttpServletRequest request,
            @RequestAttribute("user") CustomUserDetails user,
            @RequestBody ReportScheduleConfig schedule) {
        String instituteId = requireInstituteId(request, user);
        // Price the sections the schedule actually selected, resolved through the
        // registry so a withdrawn or renamed key cannot inflate the quote.
        double perDocument = billing
                .costOf(registry.resolve(schedule.getSections(), null))
                .doubleValue();
        return ResponseEntity.ok(scopeResolver.preview(instituteId, schedule, perDocument));
    }

    /**
     * Render this schedule as the calling admin would receive it — without
     * sending, recording a run, or charging.
     *
     * The loop that was missing: previously the only way to see a report was to
     * email real people, so every iteration cost somebody an inbox. Preview
     * deliberately does not take the idempotency path, so looking at Monday's
     * report today does not consume Monday's window.
     */
    @PostMapping("/preview")
    public ResponseEntity<ReportRunService.PreviewResult> preview(
            HttpServletRequest request,
            @RequestAttribute("user") CustomUserDetails user,
            @RequestBody ReportScheduleConfig schedule) {
        String instituteId = requireInstituteId(request, user);
        return ResponseEntity.ok(runService.preview(instituteId, schedule, user.getUserId()));
    }

    /**
     * Run this schedule immediately, for real — same pipeline, same audit, real
     * emails to every resolved recipient.
     *
     * Recorded under a distinct schedule id so a manual send can never consume
     * the scheduled window and silently cancel the next real run.
     */
    @PostMapping("/run-now")
    public ResponseEntity<String> runNow(
            HttpServletRequest request,
            @RequestAttribute("user") CustomUserDetails user,
            @RequestBody ReportScheduleConfig schedule) {
        String instituteId = requireInstituteId(request, user);
        runService.runNow(instituteId, null, schedule);
        return ResponseEntity.ok("Report sent. Check Recent reports for who received it.");
    }

    /**
     * Delivery history. Surfaced to the institute admin deliberately: reports name
     * learners, so the people running them should be able to see what went out and
     * to whom without asking us.
     */
    @GetMapping("/runs")
    public ResponseEntity<List<ReportRun>> listRuns(HttpServletRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        String instituteId = requireInstituteId(request, user);
        return ResponseEntity.ok(runRepository.findByInstituteIdOrderByCreatedAtDesc(instituteId));
    }

    /** Who received one report, and what was in their copy. */
    @GetMapping("/runs/{runId}/recipients")
    public ResponseEntity<List<ReportRunRecipient>> listRecipients(
            HttpServletRequest request,
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String runId) {
        String instituteId = requireInstituteId(request, user);
        // Scope check: a run id from another tenant must not be readable.
        ReportRun run = runRepository.findById(runId)
                .orElseThrow(() -> new VacademyException("Report run not found"));
        if (!instituteId.equals(run.getInstituteId())) {
            throw new VacademyException("Report run not found");
        }
        return ResponseEntity.ok(recipientRepository.findByRunId(runId));
    }

    /**
     * The clientId header names the institute, but it is caller-supplied — on its
     * own it is a request, not a claim. These endpoints expose recipient email
     * addresses and named-learner counts, so membership AND admin role are checked
     * against the authenticated principal before the header is trusted.
     * InstituteAccessValidator is already the platform pattern (49 call sites); the
     * handful of controllers that read the header bare are the exception, not the
     * standard to copy.
     */
    private String requireInstituteId(HttpServletRequest request, CustomUserDetails user) {
        String instituteId = request.getHeader("clientId");
        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("Missing clientId header");
        }
        instituteAccessValidator.requireAdminAccess(user, instituteId);
        return instituteId;
    }
}
