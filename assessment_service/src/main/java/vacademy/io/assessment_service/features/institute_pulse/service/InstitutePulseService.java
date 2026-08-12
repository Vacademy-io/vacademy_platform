package vacademy.io.assessment_service.features.institute_pulse.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.institute_pulse.dto.AssessmentFunnelProjection;
import vacademy.io.assessment_service.features.institute_pulse.dto.AssessmentSubmissionProjection;
import vacademy.io.assessment_service.features.institute_pulse.dto.AssessmentTotalsProjection;
import vacademy.io.assessment_service.features.institute_pulse.dto.AttemptRiskProjection;
import vacademy.io.assessment_service.features.institute_pulse.dto.EvaluationFunnelProjection;
import vacademy.io.assessment_service.features.institute_pulse.dto.InstitutePulseSummaryResponse;
import vacademy.io.assessment_service.features.institute_pulse.repository.InstitutePulseRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Builds the Institute Pulse assessment rail. Two queries per cache miss for the whole institute;
 * everything else (totals, risk labelling, ordering) is derived here over already-bounded sets.
 */
@Service
@RequiredArgsConstructor
public class InstitutePulseService {

    private final InstitutePulseRepository repository;
    private final InstitutePulseCache cache;

    /** No server sync within this window => the attempt is stalled. */
    @Value("${institute-pulse.assessment.stalled-seconds:120}")
    private long stalledSeconds;

    /**
     * MANUAL (pen-and-paper) assessments only: silence is not a risk while the learner is off
     * writing on paper. It becomes one when less than this many seconds remain on their personal
     * clock and they still haven't reconnected to upload the answer sheet. 1500s = 25 minutes,
     * chosen so support has time to phone the learner before the attempt auto-ends.
     */
    @Value("${institute-pulse.assessment.manual-return-window-seconds:1500}")
    private long manualReturnSeconds;

    /** Less than this left before start_time + max_time => auto-submit is imminent. */
    @Value("${institute-pulse.assessment.auto-submit-seconds:300}")
    private long autoSubmitSeconds;

    // A CLOCK_SKEW rule was removed here. It compared server_last_sync to client_last_sync, but
    // client_last_sync is written on the LIVE path via DateUtil.convertStringToDate, a DATE-ONLY
    // ("dd-MM-yyyy") formatter, so the stored value is mangled — real rows hold dates in year 33.
    // 68% of attempts exceeded any sane threshold, so the rule could only ever produce false
    // positives. Nothing reads that column elsewhere, and learner timers/auto-submit run off the
    // SERVER clock (start_time + max_time), so no learner is affected by the underlying bug.

    /** Hard cap on returned risk rows; an institute can have thousands of attempts live. */
    @Value("${institute-pulse.assessment.risk-limit:50}")
    private int riskLimit;

    /** Lookback for the submissions handed to the live feed. Matches the feed's own window. */
    @Value("${institute-pulse.assessment.feed-window-minutes:15}")
    private int feedWindowMinutes;

    /** Cap on submissions returned to the feed; the feed merges and re-caps client-side anyway. */
    @Value("${institute-pulse.assessment.feed-limit:50}")
    private int feedLimit;

    /** Assessments per page on the live funnel. */
    @Value("${institute-pulse.assessment.page-size:10}")
    private int defaultPageSize;

    /** Hard ceiling so a caller cannot request an unbounded page. */
    @Value("${institute-pulse.assessment.page-size-max:50}")
    private int maxPageSize;

    /** Cap on results-pipeline rows. Capped, not paged — it is a secondary panel. */
    @Value("${institute-pulse.assessment.evaluation-limit:20}")
    private int evaluationLimit;

    /** How far back the results pipeline looks for assessments that have ended. */
    @Value("${institute-pulse.assessment.evaluation-lookback-hours:48}")
    private int evaluationLookbackHours;

    /**
     * TTL for the results pipeline specifically. Much longer than the live payload: evaluation
     * state moves in minutes, not seconds, and this query scans a wider (backwards-looking) set
     * than anything else on the rail. Nested inside the outer cache so the pipeline query runs
     * once every few minutes even though the surrounding payload refreshes every 30s.
     */
    @Value("${institute-pulse.assessment.evaluation-cache-ttl-seconds:300}")
    private long evaluationCacheTtlSeconds;

    /**
     * TTL for the shared per-institute read cache; 0 disables it. Longer than the content and
     * live-class rails in admin_core_service (10s) because this one is served from a
     * 5-connection pool — the TTL must be at least the frontend poll interval, or the pool sees
     * one query per admin per poll instead of one per institute per TTL.
     */
    @Value("${institute-pulse.assessment.cache-ttl-seconds:30}")
    private long cacheTtlSeconds;

    public InstitutePulseSummaryResponse getSummary(String instituteId, String batchId,
                                                    Integer page, Integer limit) {
        int pageIndex = (page == null || page < 0) ? 0 : page;
        int pageSize = (limit == null || limit <= 0) ? defaultPageSize : Math.min(limit, maxPageSize);
        // '' means "no batch filter". Empty string rather than null keeps the native queries free
        // of CAST gymnastics for Postgres type inference; no real batch id is ever blank.
        String batch = (batchId == null || batchId.isBlank()) ? "" : batchId;
        // Page is part of the key: page 0 stays hot and shared across every admin watching this
        // institute, while deeper pages are rare and cheap to miss.
        return cache.get("assessments:" + instituteId + ":" + batch + ":" + pageIndex + ":" + pageSize,
                cacheTtlSeconds * 1000L,
                () -> computeSummary(instituteId, batch, pageIndex, pageSize));
    }

    private InstitutePulseSummaryResponse computeSummary(String instituteId, String batch,
                                                         int page, int pageSize) {
        AssessmentTotalsProjection totalsRow = repository.getLiveTotals(instituteId, batch);
        long liveAssessments = totalsRow == null ? 0 : nz(totalsRow.getLiveAssessments());
        long inProgressTotal = totalsRow == null ? 0 : nz(totalsRow.getInProgress());

        List<AssessmentFunnelProjection> funnelRows =
                repository.getLiveFunnelPage(instituteId, batch, pageSize, page * pageSize);

        List<InstitutePulseSummaryResponse.AssessmentFunnel> assessments =
                new ArrayList<>(funnelRows.size());

        for (AssessmentFunnelProjection r : funnelRows) {
            assessments.add(InstitutePulseSummaryResponse.AssessmentFunnel.builder()
                    .assessmentId(r.getAssessmentId())
                    .assessmentName(r.getAssessmentName())
                    .startEpoch(r.getStartEpoch())
                    .endEpoch(r.getEndEpoch())
                    .enrolled(nz(r.getEnrolled()))
                    .notStarted(nz(r.getNotStarted()))
                    .inPreview(nz(r.getInPreview()))
                    .inProgress(nz(r.getInProgress()))
                    .submitted(nz(r.getSubmitted()))
                    .build());
        }

        // Risks, submissions and the pipeline are page-INDEPENDENT context, so they are built
        // only for page 0. A "show more" fetch pays for the extra assessments and nothing else.
        boolean firstPage = page == 0;
        List<InstitutePulseSummaryResponse.AttemptRisk> risks =
                (firstPage && liveAssessments > 0) ? buildRisks(instituteId, batch) : List.of();
        List<InstitutePulseSummaryResponse.RecentSubmission> recentSubmissions =
                (firstPage && liveAssessments > 0) ? buildRecentSubmissions(instituteId, batch) : List.of();

        // Cached separately and for far longer than the surrounding payload — see
        // evaluationCacheTtlSeconds. Not gated on `assessments.isEmpty()`: results still need
        // chasing precisely when nothing is live any more.
        List<InstitutePulseSummaryResponse.EvaluationPipelineRow> evaluationPipeline = firstPage
                ? cache.get("evalpipeline:" + instituteId + ":" + batch, evaluationCacheTtlSeconds * 1000L,
                        () -> buildEvaluationPipeline(instituteId, batch))
                : List.of();

        return InstitutePulseSummaryResponse.builder()
                .assessments(assessments)
                .totals(InstitutePulseSummaryResponse.Totals.builder()
                        .liveAssessments(liveAssessments)
                        .inProgress(inProgressTotal)
                        .build())
                .page(page)
                // Exact rather than a limit+1 probe, because the institute-wide count is already
                // in hand from the totals query.
                .hasMore((long) page * pageSize + assessments.size() < liveAssessments)
                .risks(risks)
                .returnedRisks(risks.size())
                .riskCapped(risks.size() >= riskLimit)
                .recentSubmissions(recentSubmissions)
                .evaluationPipeline(evaluationPipeline)
                .evaluationCapped(evaluationPipeline.size() >= evaluationLimit)
                .build();
    }

    private List<InstitutePulseSummaryResponse.AttemptRisk> buildRisks(String instituteId, String batch) {
        List<AttemptRiskProjection> rows = repository.getAttemptRisks(
                instituteId, batch, stalledSeconds, autoSubmitSeconds, manualReturnSeconds, riskLimit);

        List<InstitutePulseSummaryResponse.AttemptRisk> risks = new ArrayList<>(rows.size());
        for (AttemptRiskProjection r : rows) {
            List<String> reasons = new ArrayList<>(2);

            Long remaining = r.getSecondsRemaining();
            if (remaining != null && remaining < 0) {
                reasons.add("OVERRUN");
            } else if (remaining != null && remaining < autoSubmitSeconds) {
                reasons.add("AUTO_SUBMIT_SOON");
            }

            Long sinceSync = r.getSecondsSinceSync();
            if (sinceSync == null || sinceSync > stalledSeconds) {
                reasons.add("STALLED");
            }

            risks.add(InstitutePulseSummaryResponse.AttemptRisk.builder()
                    .attemptId(r.getAttemptId())
                    .assessmentId(r.getAssessmentId())
                    .assessmentName(r.getAssessmentName())
                    .userId(r.getUserId())
                    .participantName(r.getParticipantName())
                    .secondsSinceSync(sinceSync)
                    .secondsRemaining(remaining)
                    .reasons(reasons)
                    .primaryReason(reasons.isEmpty() ? null : reasons.get(0))
                    .build());
        }
        return risks;
    }

    private List<InstitutePulseSummaryResponse.RecentSubmission> buildRecentSubmissions(String instituteId, String batch) {
        Instant sinceCutoff = Instant.now().minusSeconds(feedWindowMinutes * 60L);
        List<AssessmentSubmissionProjection> rows =
                repository.getRecentSubmissions(instituteId, batch, sinceCutoff, feedLimit);

        List<InstitutePulseSummaryResponse.RecentSubmission> out = new ArrayList<>(rows.size());
        for (AssessmentSubmissionProjection r : rows) {
            out.add(InstitutePulseSummaryResponse.RecentSubmission.builder()
                    .attemptId(r.getAttemptId())
                    .assessmentId(r.getAssessmentId())
                    .assessmentName(r.getAssessmentName())
                    .userId(r.getUserId())
                    .participantName(r.getParticipantName())
                    .submittedAtEpoch(r.getSubmittedAtEpoch())
                    .build());
        }
        return out;
    }

    private List<InstitutePulseSummaryResponse.EvaluationPipelineRow> buildEvaluationPipeline(
            String instituteId, String batch) {
        Instant endedSince = Instant.now().minusSeconds(evaluationLookbackHours * 3600L);
        List<EvaluationFunnelProjection> rows =
                repository.getEvaluationPipeline(instituteId, batch, endedSince, evaluationLimit);

        List<InstitutePulseSummaryResponse.EvaluationPipelineRow> out = new ArrayList<>(rows.size());
        for (EvaluationFunnelProjection r : rows) {
            out.add(InstitutePulseSummaryResponse.EvaluationPipelineRow.builder()
                    .assessmentId(r.getAssessmentId())
                    .assessmentName(r.getAssessmentName())
                    .endedAtEpoch(r.getEndedAtEpoch())
                    .submitted(nz(r.getSubmitted()))
                    .awaiting(nz(r.getAwaiting()))
                    .evaluating(nz(r.getEvaluating()))
                    .evaluated(nz(r.getEvaluated()))
                    .failed(nz(r.getFailed()))
                    .released(nz(r.getReleased()))
                    .build());
        }
        return out;
    }

    private static long nz(Long v) {
        return v == null ? 0L : v;
    }
}
