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

                // Step 3: Persist completed report + mark COMPLETED atomically
                String reportJson = objectMapper.writeValueAsString(report);
                StudentAnalysisProcess completed = persistenceService.saveCompletedReport(process.getId(), reportJson);

                log.info("[Student-Analysis-Processor] [v2] Successfully completed for processId={}", process.getId());

                // Notify the learner (best-effort) — runs AFTER COMPLETED is committed
                notifyLearnerSafe(completed);
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
