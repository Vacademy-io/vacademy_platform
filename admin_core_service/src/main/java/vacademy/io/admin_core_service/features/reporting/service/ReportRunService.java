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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
    private final ReportingScopeResolver scopeResolver;
    private final ReportRecipientResolver recipientResolver;
    private final ReportWindowResolver windowResolver;
    private final vacademy.io.admin_core_service.features.institute.repository.InstituteRepository instituteRepository;

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
        List<ReportingScopeResolver.Scope> scopes = scopeResolver.resolve(instituteId, schedule);

        for (ReportingScopeResolver.Scope scope : scopes) {
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
                            ReportingScopeResolver.Scope scope) {

        Timestamp windowStart = Timestamp.from(window.start());

        // ── 1. Claim ────────────────────────────────────────────────────────
        // A prior row for this (schedule, window, scope) means one of three things:
        // it succeeded or was skipped — nothing to do; or it FAILED — reuse the row
        // and try again. Re-inserting is not an option: the unique index has no
        // status column, so a retry would collide with its own earlier attempt.
        ReportRun run;
        var prior = runRepository.findExisting(schedule.getId(), windowStart, scope.id());
        if (prior.isPresent()) {
            run = prior.get();
            if (!"FAILED".equals(run.getStatus())) {
                log.debug("[reporting] schedule {} scope {} already {} for window {} — skipping",
                        schedule.getId(), scope.id(), run.getStatus(), windowStart);
                return;
            }
            log.info("[reporting] retrying failed run {} (schedule {} scope {})",
                    run.getId(), schedule.getId(), scope.id());
            run.setStatus("PENDING");
            run.setErrorMessage(null);
            run = runRepository.saveAndFlush(run);
        } else {
            run = ReportRun.builder()
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
                // Another replica claimed it between our check and our insert.
                // Correct outcome — the index did its job.
                log.debug("[reporting] concurrent claim for schedule {} window {} — yielding",
                        schedule.getId(), windowStart);
                return;
            }
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

            // Recipients are grouped by what they may SEE, and the sections are
            // computed once per group. Computing institute-wide and filtering
            // afterwards cannot work for a capped list: the cap is applied to the
            // institute ordering, so a teacher whose learners fall outside it is
            // told they have none. Grouping keeps the cost bounded — typically one
            // group for every admin plus one per teacher.
            List<ReportRecipientResolver.Recipient> recipients =
                    recipientResolver.resolve(instituteId, schedule);
            if (recipients.isEmpty()) {
                throw new IllegalStateException("no recipients resolved for schedule " + schedule.getId());
            }

            Map<String, List<ReportRecipientResolver.Recipient>> groups = recipients.stream()
                    .collect(Collectors.groupingBy(ReportRunService::visibilityKey,
                            LinkedHashMap::new, Collectors.toList()));

            Map<String, List<SectionFacts>> factsByGroup = new LinkedHashMap<>();
            for (var g : groups.entrySet()) {
                ReportContext groupCtx = ctx.toBuilder()
                        .visibleLearnerIds(g.getValue().get(0).getVisibleLearnerIds())
                        .visibleCohortIds(g.getValue().get(0).getVisibleCohortIds())
                        .build();
                List<SectionFacts> f = new ArrayList<>();
                for (ReportSection sec : selected) {
                    f.add(sec.compute(groupCtx)); // a failure propagates — see the SPI contract
                }
                factsByGroup.put(g.getKey(), f);
            }

            // ── 3. Gate ─────────────────────────────────────────────────────
            // Across ALL groups, not just one. Reading a single group would let a
            // teacher with an empty cohort cancel the run for the admins who do
            // have data — the groups exist precisely because they see different
            // things, so "is there anything to say" is a question about all of them.
            boolean anyGroupHasData = factsByGroup.values().stream()
                    .flatMap(List::stream)
                    .anyMatch(f -> !f.isEmpty());

            if (factsByGroup.values().stream().allMatch(List::isEmpty)
                    || (!anyGroupHasData && schedule.isSkipIfNoData())) {
                run.setStatus("SKIPPED");
                run.setSkipReason(anyGroupHasData ? "no sections resolved" : "no data in window");
                runRepository.save(run);
                log.info("[reporting] institute {} schedule {} scope {} skipped — {}",
                        instituteId, schedule.getId(), scope.id(), run.getSkipReason());
                return;
            }

            // ── 4. Deliver ──────────────────────────────────────────────────
            Delivery delivery = deliver(instituteId, instituteName, window, run, selected, groups, factsByGroup);
            int delivered = delivery.sent();
            int namedLearners = delivery.namedLearners();

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
            run.setSectionsIncluded(selected.stream().map(ReportSection::key).collect(Collectors.joining(",")));
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

    /** What a delivery pass actually did. */
    private record Delivery(int sent, int namedLearners) {}

    /**
     * Render a schedule exactly as ONE named reader would receive it, without
     * sending anything, writing a run row, or charging.
     *
     * This is the loop that was missing: until now the only way to see a report
     * was to email real people, so every iteration cost an inbox. Preview is
     * scoped to the caller — an admin sees the admin document, a teacher sees
     * their own cohorts — because "what will this look like" is only a useful
     * answer if it is the reader's actual view rather than an idealised one.
     *
     * Deliberately does NOT take the idempotency path: previewing must not
     * consume the window and stop the real run from happening later.
     */
    public PreviewResult preview(String instituteId, ReportScheduleConfig schedule, String asUserId) {
        ReportWindowResolver.Window window = windowResolver.previewWindow(schedule, null);

        List<ReportingScopeResolver.Scope> scopes = scopeResolver.resolve(instituteId, schedule);
        if (scopes.isEmpty()) {
            return new PreviewResult(null, "This schedule resolves to no reports.", 0, 0);
        }
        ReportingScopeResolver.Scope scope = scopes.get(0);

        List<ReportSection> selected = registry.resolve(schedule.getSections(), null).stream()
                .filter(sec -> sec.supportedScopes().contains(scope.type()))
                .toList();
        if (selected.isEmpty()) {
            return new PreviewResult(null,
                    "No selected section supports " + scope.type() + " scope.", scopes.size(), 0);
        }

        // Resolve the caller among the schedule's recipients so the preview shows
        // THEIR document. If they are not a recipient, fall back to an
        // unrestricted view and say so in the note.
        List<ReportRecipientResolver.Recipient> recipients =
                recipientResolver.resolve(instituteId, schedule);
        ReportRecipientResolver.Recipient me = recipients.stream()
                .filter(r -> r.getUserId() != null && r.getUserId().equals(asUserId))
                .findFirst().orElse(null);

        ReportContext ctx = ReportContext.builder()
                .instituteId(instituteId).zone(window.zone())
                .windowStart(window.start()).windowEnd(window.end())
                .scopeType(scope.type()).scopeId(scope.id()).scopeLabel(scope.label())
                .visibleLearnerIds(me == null ? null : me.getVisibleLearnerIds())
                .visibleCohortIds(me == null ? null : me.getVisibleCohortIds())
                .build();

        Set<String> roles = me == null ? null : me.getRoles();
        Set<String> visibleKeys = registry.resolve(schedule.getSections(), roles).stream()
                .map(ReportSection::key).collect(Collectors.toSet());

        List<SectionFacts> facts = new ArrayList<>();
        for (ReportSection sec : selected) {
            if (!visibleKeys.contains(sec.key())) continue;
            facts.add(truncateForDisplay(sec.compute(ctx)));
        }

        int named = facts.stream().filter(SectionFacts::isIdentifying)
                .mapToInt(f -> f.getRows() == null ? 0 : f.getRows().size()).sum();

        String note = me == null
                ? "You are not a recipient of this schedule — showing the unrestricted view."
                : null;
        if (facts.stream().allMatch(SectionFacts::isEmpty) && schedule.isSkipIfNoData()) {
            note = "Nothing to report for this window — the real run would be skipped.";
        }

        String html = renderer.render(
                instituteNameOf(instituteId), scope.label(), window.label(), facts);
        return new PreviewResult(html, note, scopes.size(), named);
    }

    public record PreviewResult(String html, String note, int documentsPerRun, int namedLearners) {}

    private String instituteNameOf(String instituteId) {
        try {
            return instituteRepository.findById(instituteId)
                    .map(i -> i.getInstituteName() == null ? "Vacademy" : i.getInstituteName())
                    .orElse("Vacademy");
        } catch (Exception e) {
            return "Vacademy";
        }
    }

    /**
     * Run a schedule immediately, for real — same pipeline, same audit, same
     * emails.
     *
     * The run is recorded under a distinct schedule id ("<id>@manual:<epoch>") so
     * it can never collide with the scheduled run's idempotency key. A manual
     * send must not consume the window and silently cancel Monday's report, and
     * two manual sends should both appear in the audit rather than the second
     * being swallowed as a duplicate.
     */
    public void runNow(String instituteId, String instituteName, ReportScheduleConfig schedule) {
        ReportScheduleConfig manual = schedule.copy();
        manual.setId(schedule.getId() + "@manual:" + System.currentTimeMillis());
        execute(instituteId, instituteName, manual,
                windowResolver.previewWindow(schedule, null));
    }

    private Delivery deliver(String instituteId, String instituteName,
                        ReportWindowResolver.Window window, ReportRun run,
                        List<ReportSection> selected,
                        Map<String, List<ReportRecipientResolver.Recipient>> groups,
                        Map<String, List<SectionFacts>> factsByGroup) {

        List<String> selectedKeys = selected.stream().map(ReportSection::key).toList();

        String subject = (instituteName == null ? "Vacademy" : instituteName) + " — " + run.getScopeLabel();
        int sent = 0;
        int namedTotal = 0;

        for (var g : groups.entrySet()) {
            List<SectionFacts> groupFacts = factsByGroup.getOrDefault(g.getKey(), List.of());

            for (ReportRecipientResolver.Recipient r : g.getValue()) {
                // Sections this role may see at all. An empty role set is passed
                // through verbatim — substituting null would disable the filter and
                // hand a roleless recipient the ADMIN-only sections.
                List<ReportSection> visible = registry.resolve(selectedKeys,
                        r.getRoles() == null ? Set.<String>of() : r.getRoles());
                Set<String> visibleKeys = visible.stream().map(ReportSection::key).collect(Collectors.toSet());

                List<SectionFacts> forUser = groupFacts.stream()
                        .filter(f -> visibleKeys.contains(f.getSectionKey()))
                        .map(this::truncateForDisplay)
                        .filter(f -> !f.isEmpty())
                        .toList();

                if (forUser.isEmpty()) {
                    log.debug("[reporting] recipient {} sees nothing in run {} — not sent", r.getUserId(), run.getId());
                    continue;
                }

                int namedForThisReader = forUser.stream().filter(SectionFacts::isIdentifying)
                        .mapToInt(f -> f.getRows() == null ? 0 : f.getRows().size()).sum();

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
                        // Run-level count reflects what was RENDERED and delivered,
                        // matching the per-recipient audit rows rather than the
                        // wider slice the sections computed.
                        namedTotal += namedForThisReader;
                    }
                } catch (Exception e) {
                    error = truncate(e.getMessage());
                    log.warn("[reporting] delivery failed for recipient {} on run {}", r.getUserId(), run.getId(), e);
                }

                recipientRepository.save(ReportRunRecipient.builder()
                        .runId(run.getId())
                        .userId(r.getUserId())
                        .email(r.getEmail())
                        .role(r.getRoles() == null ? null : String.join(",", r.getRoles()))
                        // Audit what was RENDERED, not what was permitted.
                        .sectionsSent(forUser.stream().map(SectionFacts::getSectionKey)
                                .collect(Collectors.joining(",")))
                        .namedLearners(namedForThisReader)
                        .delivered(ok)
                        .errorMessage(error)
                        .build());
            }
        }
        return new Delivery(sent, namedTotal);
    }

    /** Recipients with the same visibility get the same computed facts. */
    private static String visibilityKey(ReportRecipientResolver.Recipient r) {
        // Both axes belong in the key. They move together today (same faculty
        // mapping), but keying on only one would silently hand one reader another
        // reader's computed facts the moment they diverge.
        return part(r.getVisibleLearnerIds()) + "|" + part(r.getVisibleCohortIds());
    }

    private static String part(List<String> ids) {
        if (ids == null) return "ALL";
        return "SCOPED:" + new java.util.TreeSet<>(ids).hashCode() + ":" + ids.size();
    }

    /**
     * Rows shown in a document. Sections compute a wider slice, and this cut now
     * happens on an ALREADY cohort-scoped result, so it can no longer zero out a
     * teacher whose learners sat outside the institute-wide ordering.
     */
    private static final int MAX_DISPLAY_ROWS = 25;

    private SectionFacts truncateForDisplay(SectionFacts f) {
        List<SectionFacts.Row> rows = f.getRows();
        if (rows == null || rows.size() <= MAX_DISPLAY_ROWS) return f;

        // Declare the cut. A table that just stops reads as the complete list, and
        // a section may deliberately put its most important rows LAST — live
        // attendance appends the classes recording nothing after the ranked ones,
        // and silently dropping those loses the finding the section exists to make.
        List<SectionFacts.Row> shown = new ArrayList<>(rows.subList(0, MAX_DISPLAY_ROWS));
        int columns = f.getColumns() == null ? 1 : Math.max(1, f.getColumns().size());
        SectionFacts.Row.RowBuilder note = SectionFacts.Row.builder()
                .value((rows.size() - MAX_DISPLAY_ROWS) + " further rows not shown");
        for (int i = 1; i < columns; i++) note.value("");
        shown.add(note.build());

        return SectionFacts.builder()
                .sectionKey(f.getSectionKey()).title(f.getTitle())
                .identifying(f.isIdentifying()).headlines(f.getHeadlines())
                .columns(f.getColumns()).rows(shown)
                .empty(f.isEmpty()).build();
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() > 1000 ? s.substring(0, 1000) : s;
    }
}
