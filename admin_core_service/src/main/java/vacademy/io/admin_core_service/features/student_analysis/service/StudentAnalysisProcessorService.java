package vacademy.io.admin_core_service.features.student_analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.student_analysis.dto.StudentAnalysisData;
import vacademy.io.admin_core_service.features.student_analysis.dto.StudentReportData;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.AiInsightsSection;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.ComprehensiveStudentReport;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.TopicConfidence;

import java.util.stream.Collectors;
import vacademy.io.admin_core_service.features.student_analysis.entity.StudentAnalysisProcess;
import vacademy.io.admin_core_service.features.student_analysis.service.aggregation.ComprehensiveReportAggregator;
import vacademy.io.admin_core_service.features.student_analysis.service.aggregation.ReportModule;

import java.time.Duration;
import java.util.Set;

/**
 * Async service to process student analysis requests.
 *
 * <p>v1 path (existing, UNCHANGED): uses StudentAnalysisDataService + StudentReportLLMService.
 * <p>v2 path (new): uses ComprehensiveReportAggregator (Layer-1) + ComprehensiveReportLLMService (Layer-2).
 * The branch is determined by {@code process.reportVersion}.
 *
 * <h3>Transaction strategy</h3>
 * <p>This method is {@code @Async} and intentionally NOT {@code @Transactional}.
 * Running a 150-second aggregation+LLM chain inside a single transaction would hold
 * a DB connection for that entire duration, exhausting the pool and making the
 * intermediate PROCESSING status write invisible to pollers until the final commit.
 *
 * <p>Instead, every DB write is delegated to {@link StudentAnalysisPersistenceService},
 * whose short {@code @Transactional} methods each acquire, use, and release a connection
 * independently:
 * <ol>
 *   <li>{@code markProcessing} — commits PROCESSING before the long work starts.
 *   <li>{@code updateUserLinkedData} — commits strengths/weaknesses after LLM returns.
 *   <li>{@code saveCompletedReport} — commits report JSON + COMPLETED atomically.
 *   <li>{@code markFailed} — commits FAILED + error message on any exception.
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentAnalysisProcessorService {

        private final StudentAnalysisDataService dataService;
        private final StudentReportLLMService llmService;
        private final ObjectMapper objectMapper;

        // v2 dependencies (injected alongside v1, no removal of existing fields)
        private final ComprehensiveReportAggregator comprehensiveAggregator;
        private final ComprehensiveReportLLMService comprehensiveLLMService;

        // Transactional persistence — separate bean so @Transactional proxy applies
        private final StudentAnalysisPersistenceService persistenceService;

        // Read-only access to prior reports for trend/change computation (B3).
        private final vacademy.io.admin_core_service.features.student_analysis.repository.StudentAnalysisProcessRepository processRepository;

        // Learner notification (best-effort; never affects report generation)
        private final StudentReportNotificationService studentReportNotificationService;

        /**
         * Process student analysis asynchronously.
         *
         * <p>NOT @Transactional — see class-level javadoc for the rationale.
         * Each DB write is handled by {@link StudentAnalysisPersistenceService}.
         */
        @Async
        public void processStudentAnalysis(String processId) {
                log.info("[Student-Analysis-Processor] Starting async processing for process ID: {}", processId);

                // Commit PROCESSING immediately so pollers see it before the long work starts.
                StudentAnalysisProcess process = persistenceService.markProcessing(processId);

                try {
                        boolean isV2 = "v2".equalsIgnoreCase(process.getReportVersion());

                        if (isV2) {
                                processV2(process);
                        } else {
                                processV1(process);
                        }

                } catch (Exception e) {
                        log.error("[Student-Analysis-Processor] Failed to process analysis for process ID: {}",
                                        processId, e);
                        persistenceService.markFailed(processId, e.getMessage());
                }
        }

        // ── v1 path (UNCHANGED from original) ────────────────────────────────────
        private void processV1(StudentAnalysisProcess process) throws Exception {
                // Step 1: Collect all student data
                log.info("[Student-Analysis-Processor] [v1] Collecting student data");
                StudentAnalysisData data = dataService.collectStudentData(
                                process.getUserId(),
                                process.getStartDateIso(),
                                process.getEndDateIso());

                // Step 2: Generate LLM report
                log.info("[Student-Analysis-Processor] [v1] Generating LLM report");
                StudentReportData report = llmService.generateStudentReport(data)
                                .blockOptional(Duration.ofSeconds(70))
                                .orElseThrow(() -> new RuntimeException("LLM timeout or returned null report"));

                // Step 3: Save report as JSON
                String reportJson = objectMapper.writeValueAsString(report);

                // Step 4: Update user_linked_data with strengths and weaknesses
                // (runs in its own @Transactional method so flush() has a live persistence context)
                log.info("[Student-Analysis-Processor] [v1] Updating user linked data");
                persistenceService.updateUserLinkedData(process.getUserId(), report.getStrengths(), report.getWeaknesses());

                // Step 5: Persist completed report + mark COMPLETED atomically
                StudentAnalysisProcess completed = persistenceService.saveCompletedReport(process.getId(), reportJson);

                log.info("[Student-Analysis-Processor] [v1] Successfully completed for processId={}", process.getId());

                // Step 6: Notify the learner (best-effort) — runs AFTER COMPLETED is committed
                notifyLearnerSafe(completed);
        }

        // ── v2 path (new comprehensive report) ───────────────────────────────────
        private void processV2(StudentAnalysisProcess process) throws Exception {
                log.info("[Student-Analysis-Processor] [v2] Collecting comprehensive data");

                // Step 1: Layer-1 deterministic aggregation — only the admin-selected modules are queried
                Set<String> modules = ReportModule.resolveCsv(process.getIncludedModules());
                log.info("[Student-Analysis-Processor] [v2] Including modules: {}", modules);
                // BUG-13: if batchId is absent but packageSessionId is provided, use it as the
                // effective batch id so attendance/live-class/progress collectors still run.
                String effectiveBatchId = process.getBatchId() != null
                                ? process.getBatchId()
                                : process.getPackageSessionId();
                ComprehensiveStudentReport report = comprehensiveAggregator.collect(
                                process.getUserId(),
                                process.getInstituteId(),
                                effectiveBatchId,
                                process.getStartDateIso(),
                                process.getEndDateIso(),
                                modules);

                // Step 1.5: Enrich headline-metric trends from the most recent prior report (best-effort).
                // Done before narration so the LLM also sees the trend context.
                enrichTrends(report, process);

                // Step 2: Layer-2 AI narrative (best-effort; failure → report without ai_insights)
                log.info("[Student-Analysis-Processor] [v2] Generating AI narrative");
                try {
                        AiInsightsSection insights = comprehensiveLLMService.narrate(report, process.getUserId())
                                        .blockOptional(Duration.ofSeconds(90))
                                        .orElse(null);

                        if (insights != null) {
                                report.setAiInsights(insights);

                                // Lift @JsonIgnore fields from the AI section to their canonical report-top-level homes
                                if (insights.getParentSummary() != null) {
                                        report.setParentSummary(insights.getParentSummary());
                                }
                                if (insights.getOverviewOneLine() != null && report.getOverview() != null) {
                                        report.getOverview().setOneLine(insights.getOverviewOneLine());
                                }

                                // Lift the v1-style deep Markdown narrative to the report top level.
                                if (insights.getNarrative() != null) {
                                        report.setNarrative(insights.getNarrative());
                                }

                                // Convert LLM strength/weakness maps (topic→confidence) to TopicConfidence lists
                                // at report top level so they appear in the serialized report_json.
                                if (insights.getStrengthsMap() != null && !insights.getStrengthsMap().isEmpty()) {
                                        report.setStrengths(insights.getStrengthsMap().entrySet().stream()
                                                .map(e -> TopicConfidence.builder()
                                                        .topic(e.getKey()).confidence(e.getValue()).build())
                                                .collect(Collectors.toList()));
                                }
                                if (insights.getWeaknessesMap() != null && !insights.getWeaknessesMap().isEmpty()) {
                                        report.setAreasToImprove(insights.getWeaknessesMap().entrySet().stream()
                                                .map(e -> TopicConfidence.builder()
                                                        .topic(e.getKey()).confidence(e.getValue()).build())
                                                .collect(Collectors.toList()));
                                }

                                // Merge strengths/weaknesses into user_linked_data (same as v1).
                                // Runs in its own @Transactional method so flush() has a live persistence context.
                                persistenceService.updateUserLinkedData(
                                        process.getUserId(), insights.getStrengthsMap(), insights.getWeaknessesMap());
                        } else {
                                log.warn("[Student-Analysis-Processor] [v2] AI narrative timed out; report will have no ai_insights.");
                        }
                } catch (Exception llmEx) {
                        log.error("[Student-Analysis-Processor] [v2] AI narrative failed (non-fatal): {}", llmEx.getMessage());
                        // Report is still saved without ai_insights — deterministic data is preserved
                }

                // Step 2b: Deterministic fallback — guarantee strengths / areas-to-improve /
                // improvement-path are present even if the LLM returned empty or timed out.
                ensureInsightsFromFacts(report);

                // Step 2c: "Marks by Subject" LLM clustering (best-effort). The aggregator already
                // populated report.subjectMarks with a deterministic (DB-subject-hint) grouping;
                // here we try to upgrade it to LLM-clustered subjects and, on ANY failure or empty
                // result, silently keep the deterministic grouping already in place — this codebase
                // has learned the LLM can be unreliable, so the fallback is mandatory, not optional.
                clusterSubjectMarksSafe(report, process.getUserId());

                // Step 3: Persist completed report + mark COMPLETED atomically
                String reportJson = objectMapper.writeValueAsString(report);
                StudentAnalysisProcess completed = persistenceService.saveCompletedReport(process.getId(), reportJson);

                log.info("[Student-Analysis-Processor] [v2] Successfully completed for processId={}", process.getId());

                // Notify the learner (best-effort) — runs AFTER COMPLETED is committed
                notifyLearnerSafe(completed);
        }

        /**
         * B3: Enrich {@code overview.headline_metrics} with trend/change vs the most recent prior
         * COMPLETED v2 report for the same user + package-session. Best-effort and READ-ONLY — any
         * failure (no prior report, unparseable JSON) simply leaves trends null, exactly as before.
         */
        private void enrichTrends(ComprehensiveStudentReport report, StudentAnalysisProcess process) {
                try {
                        if (report.getOverview() == null || report.getOverview().getHeadlineMetrics() == null
                                        || report.getOverview().getHeadlineMetrics().isEmpty()) {
                                return;
                        }
                        String packageSessionId = process.getPackageSessionId() != null
                                        ? process.getPackageSessionId()
                                        : process.getBatchId();
                        if (packageSessionId == null) {
                                return; // can't scope a comparable prior report
                        }

                        var priorOpt = processRepository.findMostRecentPriorV2Report(
                                        process.getUserId(), packageSessionId, process.getEndDateIso());
                        if (priorOpt.isEmpty() || priorOpt.get().getReportJson() == null) {
                                return;
                        }

                        ComprehensiveStudentReport prior = objectMapper.readValue(
                                        priorOpt.get().getReportJson(), ComprehensiveStudentReport.class);
                        if (prior.getOverview() == null || prior.getOverview().getHeadlineMetrics() == null) {
                                return;
                        }

                        // Map prior metrics by key → numeric value (skip non-numeric like "3 / 5").
                        java.util.Map<String, Double> priorByKey = new java.util.HashMap<>();
                        prior.getOverview().getHeadlineMetrics().forEach(m -> {
                                Double v = numericValue(m.getValue());
                                if (m.getKey() != null && v != null) priorByKey.put(m.getKey(), v);
                        });
                        if (priorByKey.isEmpty()) return;

                        for (var metric : report.getOverview().getHeadlineMetrics()) {
                                Double cur = numericValue(metric.getValue());
                                Double prev = metric.getKey() != null ? priorByKey.get(metric.getKey()) : null;
                                if (cur == null || prev == null) continue;

                                double delta = cur - prev;
                                double rounded = Math.round(delta * 10.0) / 10.0;
                                metric.setTrend(rounded > 0.5 ? "up" : (rounded < -0.5 ? "down" : "steady"));
                                // Only set a change label when the metric doesn't already carry one
                                // (e.g. study_time uses change for "~N min/day").
                                if (metric.getChange() == null) {
                                        String unit = metric.getUnit() != null ? metric.getUnit() : "";
                                        String num = (rounded == Math.floor(rounded))
                                                        ? String.valueOf((long) rounded) : String.valueOf(rounded);
                                        metric.setChange((rounded >= 0 ? "+" : "") + num + unit + " vs last");
                                }
                        }
                        log.info("[Student-Analysis-Processor] [v2] Enriched headline-metric trends from prior report {}",
                                        priorOpt.get().getId());
                } catch (Exception e) {
                        log.warn("[Student-Analysis-Processor] [v2] Trend enrichment skipped (non-fatal): {}", e.getMessage());
                }
        }

        /** Best-effort numeric coercion of a HeadlineMetric value (Number or numeric String). */
        private Double numericValue(Object value) {
                if (value == null) return null;
                if (value instanceof Number n) return n.doubleValue();
                try {
                        String s = value.toString().trim();
                        // Ignore composite values like "3 / 5" — not a single comparable number.
                        if (s.contains("/")) return null;
                        return Double.parseDouble(s.replaceAll("[^0-9.\\-]", ""));
                } catch (Exception e) {
                        return null;
                }
        }

        /**
         * Deterministic safety net for the "insight" sections. The LLM is the primary author,
         * but if it returned empty strengths/areas (or timed out entirely), we derive them from
         * the Layer-1 facts so the report is never missing strengths, areas-to-improve, or an
         * improvement path — restoring v1's reliability, which computed these from learner data.
         *
         * <p>Only fills what's blank; anything the LLM already produced is left untouched.
         */
        private void ensureInsightsFromFacts(ComprehensiveStudentReport report) {
                try {
                        // Candidate (topic, score) pairs. Priority: assessment subject score %, then course
                        // completion %, then individual assessment names (last resort so we always have topics).
                        java.util.LinkedHashMap<String, Integer> topicScores = new java.util.LinkedHashMap<>();
                        // Highest priority: per-topic mastery parsed from processed_json (real accuracy per topic).
                        if (report.getLearningInsights() != null && report.getLearningInsights().isAvailable()
                                        && report.getLearningInsights().getTopicMastery() != null) {
                                report.getLearningInsights().getTopicMastery().forEach(tm -> {
                                        if (tm.getTopic() != null && tm.getAccuracy() != null) {
                                                topicScores.putIfAbsent(tm.getTopic(), (int) Math.round(tm.getAccuracy()));
                                        }
                                });
                        }
                        if (report.getAcademics() != null && report.getAcademics().getSubjectPerformance() != null) {
                                report.getAcademics().getSubjectPerformance().forEach(sp -> {
                                        if (sp.getSubject() != null && sp.getScorePercentage() != null) {
                                                topicScores.putIfAbsent(sp.getSubject(), (int) Math.round(sp.getScorePercentage()));
                                        }
                                });
                        }
                        if (report.getCourseProgress() != null && report.getCourseProgress().getSubjects() != null) {
                                report.getCourseProgress().getSubjects().forEach(s -> {
                                        if (s.getSubject() != null && s.getCompletionPercentage() != null) {
                                                topicScores.putIfAbsent(s.getSubject(), (int) Math.round(s.getCompletionPercentage()));
                                        }
                                });
                        }
                        if (topicScores.isEmpty() && report.getAcademics() != null
                                        && report.getAcademics().getAssessments() != null) {
                                report.getAcademics().getAssessments().forEach(a -> {
                                        if (a.getName() != null && a.getPercentage() != null) {
                                                topicScores.putIfAbsent(a.getName(), (int) Math.round(a.getPercentage()));
                                        }
                                });
                        }

                        // Holistic (non-subject) signals — so a learner with no academics/progress data
                        // still yields real strengths/areas (attendance, engagement, habits, timeliness).
                        if (report.getAttendance() != null && report.getAttendance().isAvailable()
                                        && report.getAttendance().getOverallPercentage() != null) {
                                topicScores.putIfAbsent("Class Attendance",
                                                (int) Math.round(report.getAttendance().getOverallPercentage()));
                        }
                        if (report.getLiveClasses() != null && report.getLiveClasses().isAvailable()
                                        && report.getLiveClasses().getAttendancePercentage() != null) {
                                topicScores.putIfAbsent("Live Class Attendance",
                                                (int) Math.round(report.getLiveClasses().getAttendancePercentage()));
                        }
                        if (report.getStudyHabits() != null && report.getStudyHabits().isAvailable()
                                        && report.getStudyHabits().getActiveDays() != null
                                        && report.getStudyHabits().getTotalDays() != null
                                        && report.getStudyHabits().getTotalDays() > 0) {
                                int consistency = (int) Math.round(
                                                report.getStudyHabits().getActiveDays() * 100.0
                                                                / report.getStudyHabits().getTotalDays());
                                topicScores.putIfAbsent("Study Consistency", consistency);
                        }
                        if (report.getAssignments() != null && report.getAssignments().isAvailable()
                                        && report.getAssignments().getSubmitted() != null
                                        && report.getAssignments().getSubmitted() > 0
                                        && report.getAssignments().getOnTime() != null) {
                                int timeliness = (int) Math.round(
                                                report.getAssignments().getOnTime() * 100.0
                                                                / report.getAssignments().getSubmitted());
                                topicScores.putIfAbsent("Assignment Timeliness", timeliness);
                        }
                        if (report.getCourseProgress() != null && report.getCourseProgress().isAvailable()
                                        && report.getCourseProgress().getOverallCompletionPercentage() != null) {
                                topicScores.putIfAbsent("Course Completion",
                                                (int) Math.round(report.getCourseProgress().getOverallCompletionPercentage()));
                        }

                        // ── Strengths (>=60) / areas-to-improve (<60): single split, so every topic is
                        // classified and there is never a "gap band". Only fill what the LLM left blank.
                        if (report.getStrengths() == null || report.getStrengths().isEmpty()) {
                                java.util.List<TopicConfidence> strengths = topicScores.entrySet().stream()
                                                .filter(e -> e.getValue() >= 60)
                                                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                                                .limit(6)
                                                .map(e -> topic(e.getKey(), e.getValue()))
                                                .collect(Collectors.toList());
                                // Guarantee at least one relative strength when a decent topic exists.
                                if (strengths.isEmpty()) {
                                        topicScores.entrySet().stream()
                                                        .max(java.util.Map.Entry.comparingByValue())
                                                        .filter(e -> e.getValue() >= 45)
                                                        .ifPresent(e -> strengths.add(topic(e.getKey(), e.getValue())));
                                }
                                if (!strengths.isEmpty()) report.setStrengths(strengths);
                        }
                        if (report.getAreasToImprove() == null || report.getAreasToImprove().isEmpty()) {
                                java.util.List<TopicConfidence> areas = topicScores.entrySet().stream()
                                                .filter(e -> e.getValue() < 60)
                                                .sorted(java.util.Map.Entry.comparingByValue())
                                                .limit(6)
                                                .map(e -> topic(e.getKey(), e.getValue()))
                                                .collect(Collectors.toList());
                                // Guarantee at least one improvement target unless everything is already strong.
                                if (areas.isEmpty()) {
                                        topicScores.entrySet().stream()
                                                        .min(java.util.Map.Entry.comparingByValue())
                                                        .filter(e -> e.getValue() < 85)
                                                        .ifPresent(e -> areas.add(topic(e.getKey(), e.getValue())));
                                }
                                if (!areas.isEmpty()) report.setAreasToImprove(areas);
                        }

                        // ── Improvement path (recommendations) — always produce at least one when any data exists.
                        AiInsightsSection ai = report.getAiInsights();
                        boolean noRecs = ai == null || ai.getRecommendations() == null || ai.getRecommendations().isEmpty();
                        if (noRecs) {
                                java.util.List<AiInsightsSection.RecommendationItem> recs = new java.util.ArrayList<>();
                                topicScores.entrySet().stream()
                                                .filter(e -> e.getValue() < 60)
                                                .sorted(java.util.Map.Entry.comparingByValue())
                                                .limit(3)
                                                .forEach(e -> recs.add(rec(e.getValue() < 40 ? "HIGH" : "MEDIUM", e.getKey(),
                                                                "Focus extra practice on " + e.getKey()
                                                                                + " to lift it from " + e.getValue() + "%.")));
                                if (report.getAttendance() != null && report.getAttendance().isAvailable()
                                                && report.getAttendance().getOverallPercentage() != null
                                                && report.getAttendance().getOverallPercentage() < 75) {
                                        recs.add(rec("HIGH", "Attendance", "Improve class attendance — it is currently "
                                                        + Math.round(report.getAttendance().getOverallPercentage()) + "%."));
                                }
                                if (report.getAssignments() != null && report.getAssignments().isAvailable()
                                                && report.getAssignments().getLate() != null && report.getAssignments().getLate() > 0) {
                                        recs.add(rec("MEDIUM", "Assignments", "Submit assignments on time — "
                                                        + report.getAssignments().getLate() + " were late this period."));
                                }
                                // Nothing weak flagged but we do have topic data → give a "keep advancing" nudge on the lowest.
                                if (recs.isEmpty() && !topicScores.isEmpty()) {
                                        topicScores.entrySet().stream()
                                                        .min(java.util.Map.Entry.comparingByValue())
                                                        .ifPresent(e -> recs.add(rec("LOW", e.getKey(),
                                                                        "Keep advancing " + e.getKey()
                                                                                        + " and aim for full mastery.")));
                                }
                                if (!recs.isEmpty()) {
                                        if (ai == null) {
                                                ai = AiInsightsSection.builder().recommendations(recs).build();
                                                report.setAiInsights(ai);
                                        } else {
                                                ai.setRecommendations(recs);
                                        }
                                }
                        }

                        // ── Narrative floor: a plain parent_summary / summary when the LLM gave none,
                        // built only from values already in the report (no invented numbers).
                        String topStrength = (report.getStrengths() != null && !report.getStrengths().isEmpty())
                                        ? report.getStrengths().get(0).getTopic() : null;
                        String topArea = (report.getAreasToImprove() != null && !report.getAreasToImprove().isEmpty())
                                        ? report.getAreasToImprove().get(0).getTopic() : null;
                        String status = report.getOverview() != null ? report.getOverview().getOverallStatus() : null;
                        String grade = report.getOverview() != null ? report.getOverview().getOverallGrade() : null;

                        if (report.getParentSummary() == null || report.getParentSummary().isBlank()) {
                                StringBuilder sb = new StringBuilder();
                                String name = (report.getStudent() != null && report.getStudent().getName() != null)
                                                ? report.getStudent().getName() : "The student";
                                sb.append(name).append(" is ");
                                sb.append(status != null ? "currently " + status.toLowerCase() : "progressing")
                                                .append(grade != null ? " with an overall grade of " + grade + "." : ".");
                                if (topStrength != null) sb.append(" Strongest area: ").append(topStrength).append(".");
                                if (topArea != null) sb.append(" Main focus area: ").append(topArea)
                                                .append(" — see the recommended next steps below.");
                                report.setParentSummary(sb.toString());
                        }
                        if ((report.getAiInsights() == null || report.getAiInsights().getSummary() == null
                                        || report.getAiInsights().getSummary().isBlank())) {
                                String line = (topStrength != null && topArea != null)
                                                ? "Doing well in " + topStrength + "; focus next on " + topArea + "."
                                                : (status != null ? "Overall status: " + status + "." : null);
                                if (line != null) {
                                        if (report.getAiInsights() == null) {
                                                report.setAiInsights(AiInsightsSection.builder().summary(line).build());
                                        } else {
                                                report.getAiInsights().setSummary(line);
                                        }
                                }
                        }

                        // ── Cross-domain insights floor: observations connecting two sections, when the LLM gave none.
                        AiInsightsSection aiNow = report.getAiInsights();
                        boolean noCross = aiNow == null || aiNow.getCrossDomainInsights() == null
                                        || aiNow.getCrossDomainInsights().isEmpty();
                        if (noCross) {
                                java.util.List<String> cross = buildCrossDomainInsights(report);
                                if (!cross.isEmpty()) {
                                        if (aiNow == null) {
                                                report.setAiInsights(AiInsightsSection.builder().crossDomainInsights(cross).build());
                                        } else {
                                                aiNow.setCrossDomainInsights(cross);
                                        }
                                }
                        }
                } catch (Exception e) {
                        log.warn("[Student-Analysis-Processor] [v2] ensureInsightsFromFacts fallback failed (non-fatal): {}", e.getMessage());
                }
        }

        /**
         * Best-effort upgrade of {@code report.subjectMarks.subjects} from the deterministic
         * DB-subject-hint grouping (already set by {@code SubjectMarksCollector}) to LLM-clustered
         * subject domains. On any exception, timeout, or empty LLM result, the deterministic
         * grouping already on the report is left untouched — never fails report generation.
         */
        private void clusterSubjectMarksSafe(ComprehensiveStudentReport report, String userId) {
                try {
                        var subjectMarks = report.getSubjectMarks();
                        if (subjectMarks == null || !subjectMarks.isAvailable()
                                        || subjectMarks.getItems() == null || subjectMarks.getItems().isEmpty()) {
                                return;
                        }

                        var clustered = comprehensiveLLMService.clusterSubjectMarks(subjectMarks.getItems(), userId)
                                        .blockOptional(Duration.ofSeconds(60))
                                        .orElse(null);

                        // Only trust the LLM clustering when every subject is arithmetically sane
                        // (0 < obtained <= total). The model can mis-sum or hallucinate marks, which
                        // would render an impossible >100% donut; in that case keep the deterministic
                        // grouping (already correct) instead.
                        boolean allValid = clustered != null && !clustered.isEmpty()
                                        && clustered.stream().allMatch(s ->
                                                s.getMarksObtained() != null && s.getTotalMarks() != null
                                                        && s.getTotalMarks() > 0
                                                        && s.getMarksObtained() <= s.getTotalMarks() + 0.01);
                        if (allValid) {
                                subjectMarks.setSubjects(clustered);
                                log.info("[Student-Analysis-Processor] [v2] Subject-marks LLM clustering applied ({} subjects)",
                                                clustered.size());
                        } else {
                                log.info("[Student-Analysis-Processor] [v2] Subject-marks LLM clustering empty/invalid; keeping deterministic grouping.");
                        }
                } catch (Exception e) {
                        log.warn("[Student-Analysis-Processor] [v2] Subject-marks LLM clustering failed (non-fatal), keeping deterministic grouping: {}",
                                        e.getMessage());
                }
        }

        /**
         * Deterministic cross-domain observations — each connects two sections and only fires when
         * both sides have data. Uses only values already in the report (no invented numbers). Capped at 4.
         */
        private java.util.List<String> buildCrossDomainInsights(ComprehensiveStudentReport report) {
                java.util.List<String> out = new java.util.ArrayList<>();

                Double attendance = (report.getAttendance() != null && report.getAttendance().isAvailable())
                                ? report.getAttendance().getOverallPercentage() : null;
                Double avgScore = (report.getAcademics() != null && report.getAcademics().isAvailable())
                                ? report.getAcademics().getAveragePercentage() : null;
                Double completion = (report.getCourseProgress() != null && report.getCourseProgress().isAvailable())
                                ? report.getCourseProgress().getOverallCompletionPercentage() : null;
                Integer late = (report.getAssignments() != null && report.getAssignments().isAvailable())
                                ? report.getAssignments().getLate() : null;
                Integer submitted = (report.getAssignments() != null && report.getAssignments().isAvailable())
                                ? report.getAssignments().getSubmitted() : null;
                Double consistency = null;
                if (report.getStudyHabits() != null && report.getStudyHabits().isAvailable()
                                && report.getStudyHabits().getActiveDays() != null
                                && report.getStudyHabits().getTotalDays() != null
                                && report.getStudyHabits().getTotalDays() > 0) {
                        consistency = report.getStudyHabits().getActiveDays() * 100.0
                                        / report.getStudyHabits().getTotalDays();
                }
                Integer doubtsAsked = (report.getDoubtsAndEngagement() != null
                                && report.getDoubtsAndEngagement().isAvailable())
                                ? report.getDoubtsAndEngagement().getQuestionsAsked() : null;

                // Attendance vs marks
                if (attendance != null && avgScore != null) {
                        if (attendance >= 80 && avgScore < 50) {
                                out.add("Attendance is strong (" + Math.round(attendance) + "%) but assessment scores are low ("
                                                + Math.round(avgScore) + "%) — being present isn't yet translating into marks.");
                        } else if (attendance < 60 && avgScore >= 70) {
                                out.add("Scores are good (" + Math.round(avgScore) + "%) despite lower attendance ("
                                                + Math.round(attendance) + "%) — attending more classes could push results even higher.");
                        } else if (attendance >= 80 && avgScore >= 70) {
                                out.add("Consistent attendance (" + Math.round(attendance) + "%) is reflected in strong scores ("
                                                + Math.round(avgScore) + "%).");
                        }
                }
                // Study consistency vs marks
                if (consistency != null && avgScore != null) {
                        if (consistency >= 70 && avgScore < 50) {
                                out.add("Study time is consistent but scores lag — the focus may need to shift to targeted practice.");
                        } else if (consistency < 40 && avgScore >= 70) {
                                out.add("Strong scores on limited active days — a steadier study routine could compound results.");
                        }
                }
                // Course progress vs assignment timeliness
                if (completion != null && late != null && late > 0 && completion >= 70) {
                        out.add("Course progress is on track (" + Math.round(completion) + "%) but " + late
                                        + " assignment(s) were submitted late — tighter deadlines would help.");
                }
                // Help-seeking vs marks
                if (doubtsAsked != null && avgScore != null) {
                        if (doubtsAsked == 0 && avgScore < 50) {
                                out.add("No doubts were raised despite lower scores — encouraging questions could help close gaps.");
                        }
                }
                // Assignment engagement vs marks
                if (submitted != null && submitted == 0 && avgScore != null && avgScore < 60) {
                        out.add("No assignments were submitted this period, which may be holding scores back.");
                }

                return out.size() > 4 ? out.subList(0, 4) : out;
        }

        private static TopicConfidence topic(String name, int confidence) {
                return TopicConfidence.builder().topic(name).confidence(confidence).build();
        }

        private static AiInsightsSection.RecommendationItem rec(String priority, String area, String suggestion) {
                return AiInsightsSection.RecommendationItem.builder()
                                .priority(priority).area(area).suggestion(suggestion).build();
        }

        /** Fire learner notifications without ever affecting report generation. */
        private void notifyLearnerSafe(StudentAnalysisProcess process) {
                try {
                        studentReportNotificationService.notifyLearner(process);
                } catch (Exception e) {
                        log.error("[Student-Analysis-Processor] Learner notification failed for processId={} (non-fatal): {}",
                                        process.getId(), e.getMessage());
                }
        }
}
