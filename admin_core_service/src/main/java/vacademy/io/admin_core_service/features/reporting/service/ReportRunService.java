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
    private final ReportScopeResolver scopeResolver;
    private final ReportRecipientResolver recipientResolver;

    /**
     * Fan out one schedule into its documents and run each independently.
     *
     * Each scope gets its own claim, its own run row and its own failure: a batch
     * whose data is broken must not stop the other 40 batches from being reported.
     */
    public void execute(String instituteId,
                        String instituteName,
                        ReportScheduleConfig schedule,
                        ReportWindowResolver.Window window) {

        // Deliberately not caught here: the resolver fails loud by design, and the
        // scheduler's per-schedule catch is the right place to record it. Swallowing
        // it here would look identical to "nothing was due".
        List<ReportScopeResolver.Scope> scopes = scopeResolver.resolve(instituteId, schedule);

        for (ReportScopeResolver.Scope scope : scopes) {
            try {
                executeOne(instituteId, instituteName, schedule, window, scope);
            } catch (Exception e) {
                log.error("[reporting] scope {} of schedule {} failed", scope.id(), schedule.getId(), e);
            }
        }
    }

    private void executeOne(String instituteId,
                            String instituteName,
                            ReportScheduleConfig schedule,
                            ReportWindowResolver.Window window,
                            ReportScopeResolver.Scope scope) {

        Timestamp windowStart = Timestamp.from(window.start());

        // ── 1. Claim ────────────────────────────────────────────────────────
        if (runRepository.findExisting(schedule.getId(), windowStart, scope.id()).isPresent()) {
            log.debug("[reporting] schedule {} scope {} already ran for window {} — skipping",
                    schedule.getId(), scope.id(), windowStart);
            return;
        }

        ReportRun run = ReportRun.builder()
                .instituteId(instituteId)
                .scheduleId(schedule.getId())
                .windowStart(windowStart)
                .windowEnd(Timestamp.from(window.end()))
                .scopeType(scope.type().name())
                .scopeId(scope.id())
                .scopeLabel(scope.label())
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
                    .scopeType(scope.type())
                    .scopeId(scope.id())
                    .scopeLabel(run.getScopeLabel())
                    // Naming limits are a RECIPIENT property, not a scope property —
                    // the facts are computed once and filtered per reader below.
                    .visibleLearnerIds(null)
                    .build();

            List<ReportSection> selected = registry.resolve(schedule.getSections(), null).stream()
                    .filter(sec -> sec.supportedScopes().contains(scope.type()))
                    .toList();

            if (selected.isEmpty()) {
                // Every selected section is institute-only while the schedule asked
                // for per-batch documents. Sending would mean N identical copies of
                // the same institute-wide report (and N charges once billing lands).
                run.setStatus("SKIPPED");
                run.setSkipReason("no selected section supports " + scope.type() + " scope");
                runRepository.save(run);
                log.info("[reporting] schedule {} scope {} skipped — {}",
                        schedule.getId(), scope.id(), run.getSkipReason());
                return;
            }

            List<SectionFacts> facts = new ArrayList<>();
            for (ReportSection sec : selected) {
                facts.add(sec.compute(ctx)); // a failure propagates — see the SPI contract
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

            if (delivered == 0) {
                // Marking this SENT would burn the idempotency slot and lose the
                // window permanently — a two-minute auth_service blip would silently
                // cost an institute a week's report. FAILED is retryable.
                throw new IllegalStateException(
                        "no recipients could be delivered to (resolution or send failed)");
            }

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

        List<ReportRecipientResolver.Recipient> recipients =
                recipientResolver.resolve(instituteId, schedule);
        if (recipients.isEmpty()) {
            log.warn("[reporting] schedule {} resolved to no recipients — nothing sent", schedule.getId());
            return 0;
        }

        String subject = (instituteName == null ? "Vacademy" : instituteName) + " — " + run.getScopeLabel();
        int sent = 0;

        for (ReportRecipientResolver.Recipient r : recipients) {
            // Two filters, both server-side and neither overridable by config:
            //   1. sections this role may see at all
            //   2. learners this reader may be shown by name
            // Pass the role set through verbatim. Substituting null for "empty"
            // would disable the role filter entirely and hand a roleless recipient
            // the ADMIN-only sections.
            List<ReportSection> visible = registry.resolve(schedule.getSections(),
                    r.getRoles() == null ? Set.<String>of() : r.getRoles());
            Set<String> visibleKeys = visible.stream().map(ReportSection::key).collect(Collectors.toSet());

            List<SectionFacts> forUser = allFacts.stream()
                    .filter(f -> visibleKeys.contains(f.getSectionKey()))
                    .map(f -> restrictNaming(f, r.getVisibleLearnerIds()))
                    .map(this::truncateForDisplay)
                    .filter(f -> !(f.isEmpty() && f.isIdentifying()))
                    .toList();

            if (forUser.isEmpty()) {
                log.debug("[reporting] recipient {} sees nothing in schedule {} — not sent",
                        r.getUserId(), schedule.getId());
                continue;
            }

            boolean ok = false;
            String error = null;
            try {
                if (r.getEmail() == null || r.getEmail().isBlank()) {
                    error = "no email on file";
                } else {
                    notificationService.sendHtmlEmailViaUnified(
                            r.getEmail(), subject,
                            renderer.render(instituteName, run.getScopeLabel(), window.label(), forUser),
                            instituteId, null, null, "UTILITY_EMAIL");
                    ok = true;
                    sent++;
                }
            } catch (Exception e) {
                error = truncate(e.getMessage());
                log.warn("[reporting] delivery failed for recipient {} on schedule {}",
                        r.getUserId(), schedule.getId(), e);
            }

            recipientRepository.save(ReportRunRecipient.builder()
                    .runId(run.getId())
                    .userId(r.getUserId())
                    .email(r.getEmail())
                    .role(r.getRoles() == null ? null : String.join(",", r.getRoles()))
                    // Audit what was RENDERED, not what was merely permitted: a
                    // section can survive the role filter and still be dropped
                    // (empty after cohort filtering). A compliance view claiming a
                    // section was delivered when it was not is worse than no view.
                    .sectionsSent(forUser.stream().map(SectionFacts::getSectionKey)
                            .collect(Collectors.joining(",")))
                    .namedLearners(forUser.stream().filter(SectionFacts::isIdentifying)
                            .mapToInt(f -> f.getRows() == null ? 0 : f.getRows().size()).sum())
                    .delivered(ok)
                    .errorMessage(error)
                    .build());
        }
        return sent;
    }

    /**
     * Drop rows naming learners this reader may not see.
     *
     * This is the teacher hard-scope, applied at the last possible moment so the
     * expensive computation happens once per document rather than once per reader.
     * A null allow-list means no restriction; an EMPTY list means "may name nobody"
     * and must not be confused with it.
     */
    private SectionFacts restrictNaming(SectionFacts f, List<String> allowedLearnerIds) {
        if (allowedLearnerIds == null || !f.isIdentifying()) return f;

        Set<String> allowed = Set.copyOf(allowedLearnerIds);
        List<SectionFacts.Row> kept = (f.getRows() == null ? List.<SectionFacts.Row>of() : f.getRows())
                .stream()
                .filter(row -> row.getSubjectId() != null && allowed.contains(row.getSubjectId()))
                .toList();

        // Headlines are INSTITUTE-WIDE aggregates. Keeping them next to a filtered
        // list produces a document that contradicts itself — "808 learners quiet"
        // above a table of 37 — and the reader cannot tell which number applies to
        // them. Replace them with one figure that is true for this reader, and say
        // so in the title. Recomputing the aggregate per recipient would be correct
        // too, but costs a query per reader per section.
        return SectionFacts.builder()
                .sectionKey(f.getSectionKey())
                .title(f.getTitle() + " — your cohorts")
                .identifying(true)
                .headline("In your cohorts", String.valueOf(kept.size()))
                .columns(f.getColumns())
                .rows(kept.size() > MAX_DISPLAY_ROWS ? kept.subList(0, MAX_DISPLAY_ROWS) : kept)
                .empty(kept.isEmpty())
                .build();
    }

    /**
     * Rows shown in a document. Sections compute a wider slice so that this cut
     * happens after the per-recipient cohort filter — truncating first would let a
     * teacher whose learners fall outside the institute-wide top slice be told they
     * have none.
     */
    private static final int MAX_DISPLAY_ROWS = 25;

    private SectionFacts truncateForDisplay(SectionFacts f) {
        List<SectionFacts.Row> rows = f.getRows();
        if (rows == null || rows.size() <= MAX_DISPLAY_ROWS) return f;
        return SectionFacts.builder()
                .sectionKey(f.getSectionKey()).title(f.getTitle())
                .identifying(f.isIdentifying()).headlines(f.getHeadlines())
                .columns(f.getColumns()).rows(rows.subList(0, MAX_DISPLAY_ROWS))
                .empty(f.isEmpty()).build();
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() > 1000 ? s.substring(0, 1000) : s;
    }
}
