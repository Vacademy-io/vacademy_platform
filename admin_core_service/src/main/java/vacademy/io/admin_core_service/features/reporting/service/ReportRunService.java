package vacademy.io.admin_core_service.features.reporting.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.reporting.dto.ReportScheduleConfig;
import vacademy.io.admin_core_service.features.reporting.entity.ReportRun;
import vacademy.io.admin_core_service.features.reporting.entity.ReportRunRecipient;
import vacademy.io.admin_core_service.features.reporting.repository.ReportRunRecipientRepository;
import vacademy.io.admin_core_service.features.reporting.repository.ReportRunRepository;
import vacademy.io.admin_core_service.features.reporting.spi.ReportContext;
import vacademy.io.admin_core_service.features.reporting.spi.ReportSection;
import vacademy.io.admin_core_service.features.reporting.spi.ReportSectionRegistry;
import vacademy.io.admin_core_service.features.reporting.spi.SectionFacts;
import vacademy.io.common.auth.dto.UserDTO;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Generates and delivers ONE document.
 *
 * Order of operations is deliberate and should not be rearranged:
 * <ol>
 *   <li><b>Claim</b> — insert the run row first. The unique index on
 *       (schedule_id, window_start, scope) is what makes a second replica or a
 *       retry a no-op instead of a duplicate email. Claiming before doing the work
 *       is the only ordering that is safe under 4 replicas.</li>
 *   <li><b>Compute</b> — sections run; a thrower fails the run rather than
 *       rendering as a zero.</li>
 *   <li><b>Gate</b> — all-empty runs are skipped, and (Phase 2) unaffordable runs
 *       are skipped before any spend.</li>
 *   <li><b>Deliver</b> — per recipient, filtered by role, audited individually.</li>
 * </ol>
 *
 * Phase 0 is unbilled: no credits are deducted anywhere in this class. Billing
 * belongs between steps 3 and 4, and lands with the estimator so nobody is charged
 * for a run whose cost could not be predicted beforehand.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ReportRunService {

    private final ReportRunRepository runRepository;
    private final ReportRunRecipientRepository recipientRepository;
    private final ReportSectionRegistry registry;
    private final ReportRenderer renderer;
    private final NotificationService notificationService;
    private final AuthService authService;

    public void execute(String instituteId,
                        String instituteName,
                        ReportScheduleConfig schedule,
                        ReportWindowResolver.Window window) {

        Timestamp windowStart = Timestamp.from(window.start());

        // ── 1. Claim ────────────────────────────────────────────────────────
        if (runRepository.findExisting(schedule.getId(), windowStart, null).isPresent()) {
            log.debug("[reporting] schedule {} already ran for window {} — skipping", schedule.getId(), windowStart);
            return;
        }

        ReportRun run = ReportRun.builder()
                .instituteId(instituteId)
                .scheduleId(schedule.getId())
                .windowStart(windowStart)
                .windowEnd(Timestamp.from(window.end()))
                .scopeType(ReportContext.ScopeType.INSTITUTE.name())
                .scopeLabel(schedule.getName() == null ? "Institute report" : schedule.getName())
                .status("PENDING")
                .build();
        try {
            run = runRepository.saveAndFlush(run);
        } catch (DataIntegrityViolationException dup) {
            // Another replica claimed it between our check and our insert. Correct
            // outcome — the index did its job.
            log.debug("[reporting] concurrent claim for schedule {} window {} — yielding", schedule.getId(), windowStart);
            return;
        }

        try {
            // ── 2. Compute ──────────────────────────────────────────────────
            ReportContext ctx = ReportContext.builder()
                    .instituteId(instituteId)
                    .zone(window.zone())
                    .windowStart(window.start())
                    .windowEnd(window.end())
                    .scopeType(ReportContext.ScopeType.INSTITUTE)
                    .scopeLabel(run.getScopeLabel())
                    .visibleLearnerIds(null) // institute scope: no naming restriction
                    .build();

            List<ReportSection> selected = registry.resolve(schedule.getSections(), null);
            List<SectionFacts> facts = new ArrayList<>();
            for (ReportSection s : selected) {
                facts.add(s.compute(ctx)); // a failure propagates — see the SPI contract
            }

            // ── 3. Gate ─────────────────────────────────────────────────────
            boolean everythingEmpty = facts.stream().allMatch(SectionFacts::isEmpty);
            if (facts.isEmpty() || (everythingEmpty && schedule.isSkipIfNoData())) {
                run.setStatus("SKIPPED");
                run.setSkipReason(facts.isEmpty() ? "no sections resolved" : "no data in window");
                runRepository.save(run);
                log.info("[reporting] institute {} schedule {} skipped — {}",
                        instituteId, schedule.getId(), run.getSkipReason());
                return;
            }

            // ── 4. Deliver ──────────────────────────────────────────────────
            int namedLearners = facts.stream().filter(SectionFacts::isIdentifying)
                    .mapToInt(f -> f.getRows() == null ? 0 : f.getRows().size()).sum();
            int delivered = deliver(instituteId, instituteName, schedule, window, run, facts);

            run.setStatus("SENT");
            run.setRecipientCount(delivered);
            run.setNamedLearners(namedLearners);
            run.setSectionsIncluded(facts.stream().map(SectionFacts::getSectionKey).collect(Collectors.joining(",")));
            runRepository.save(run);
            log.info("[reporting] institute {} schedule {} sent to {} recipient(s), {} learner(s) named",
                    instituteId, schedule.getId(), delivered, namedLearners);

        } catch (Exception e) {
            // The run row survives as FAILED so the failure is visible in the audit
            // rather than vanishing into a log line nobody reads.
            run.setStatus("FAILED");
            run.setErrorMessage(truncate(e.getMessage()));
            try {
                runRepository.save(run);
            } catch (Exception ignored) {
                // never mask the original failure
            }
            log.error("[reporting] institute {} schedule {} FAILED", instituteId, schedule.getId(), e);
        }
    }

    private int deliver(String instituteId, String instituteName, ReportScheduleConfig schedule,
                        ReportWindowResolver.Window window, ReportRun run, List<SectionFacts> allFacts) {

        List<String> userIds = schedule.getRecipients() == null
                ? List.of() : schedule.getRecipients().getUserIds();
        if (userIds == null || userIds.isEmpty()) {
            log.warn("[reporting] schedule {} has no resolvable recipients — nothing sent", schedule.getId());
            return 0;
        }

        List<UserDTO> users;
        try {
            users = authService.getUsersFromAuthServiceByUserIds(userIds);
        } catch (Exception e) {
            throw new RuntimeException("Could not resolve report recipients", e);
        }

        String subject = (instituteName == null ? "Vacademy" : instituteName)
                + " — " + run.getScopeLabel();
        int sent = 0;

        for (UserDTO user : users) {
            // Per-recipient role filter: two people on the same schedule can receive
            // materially different documents, and the audit records the copy sent.
            Set<String> roles = user.getRoles() == null ? Set.of() : Set.copyOf(user.getRoles());
            List<ReportSection> visible = registry.resolve(schedule.getSections(), roles.isEmpty() ? null : roles);
            Set<String> visibleKeys = visible.stream().map(ReportSection::key).collect(Collectors.toSet());
            List<SectionFacts> forUser = allFacts.stream()
                    .filter(f -> visibleKeys.contains(f.getSectionKey())).toList();

            if (forUser.isEmpty()) {
                log.debug("[reporting] recipient {} sees no sections of schedule {} — not sent",
                        user.getId(), schedule.getId());
                continue;
            }

            String body = renderer.render(instituteName, run.getScopeLabel(), window.label(), forUser);
            boolean ok = false;
            String error = null;
            try {
                if (user.getEmail() == null || user.getEmail().isBlank()) {
                    error = "no email on file";
                } else {
                    notificationService.sendHtmlEmailViaUnified(
                            user.getEmail(), subject, body, instituteId, null, null, "UTILITY_EMAIL");
                    ok = true;
                    sent++;
                }
            } catch (Exception e) {
                error = truncate(e.getMessage());
                log.warn("[reporting] delivery failed for recipient {} on schedule {}",
                        user.getId(), schedule.getId(), e);
            }

            recipientRepository.save(ReportRunRecipient.builder()
                    .runId(run.getId())
                    .userId(user.getId())
                    .email(user.getEmail())
                    .role(roles.isEmpty() ? null : String.join(",", roles))
                    .sectionsSent(String.join(",", visibleKeys))
                    .namedLearners(forUser.stream().filter(SectionFacts::isIdentifying)
                            .mapToInt(f -> f.getRows() == null ? 0 : f.getRows().size()).sum())
                    .delivered(ok)
                    .errorMessage(error)
                    .build());
        }
        return sent;
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() > 1000 ? s.substring(0, 1000) : s;
    }
}
