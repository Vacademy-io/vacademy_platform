package vacademy.io.admin_core_service.features.student_analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.student_analysis.dto.StudentAnalysisData;
import vacademy.io.admin_core_service.features.student_analysis.dto.StudentReportData;
import vacademy.io.admin_core_service.features.student_analysis.entity.StudentAnalysisProcess;
import vacademy.io.admin_core_service.features.student_analysis.entity.UserLinkedData;
import vacademy.io.admin_core_service.features.student_analysis.repository.StudentAnalysisProcessRepository;
import vacademy.io.admin_core_service.features.student_analysis.repository.UserLinkedDataRepository;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Async service to process student analysis requests
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentAnalysisProcessorService {

        private final StudentAnalysisProcessRepository processRepository;
        private final UserLinkedDataRepository userLinkedDataRepository;
        private final StudentAnalysisDataService dataService;
        private final StudentReportLLMService llmService;
        private final ObjectMapper objectMapper;

        /**
         * Process student analysis asynchronously
         */
        @Async
        @Transactional
        public void processStudentAnalysis(String processId) {
                log.info("[Student-Analysis-Processor] Starting async processing for process ID: {}", processId);

                StudentAnalysisProcess process = processRepository.findById(processId)
                                .orElseThrow(() -> new RuntimeException("Process not found: " + processId));

                try {
                        // Update status to PROCESSING
                        process.setStatus("PROCESSING");
                        processRepository.save(process);

                        // Step 1: Collect all student data
                        log.info("[Student-Analysis-Processor] Collecting student data");
                        StudentAnalysisData data = dataService.collectStudentData(
                                        process.getUserId(),
                                        process.getStartDateIso(),
                                        process.getEndDateIso());

                        // Step 2: Generate LLM report (using blockOptional to prevent memory leak)
                        log.info("[Student-Analysis-Processor] Generating LLM report");
                        StudentReportData report = llmService.generateStudentReport(data)
                                        .blockOptional(Duration.ofSeconds(70))
                                        .orElseThrow(() -> new RuntimeException("LLM timeout or returned null report"));

                        // Step 3: Save report as JSON
                        String reportJson = objectMapper.writeValueAsString(report);
                        process.setReportJson(reportJson);

                        // Step 4: Update user_linked_data with strengths and weaknesses
                        log.info("[Student-Analysis-Processor] Updating user linked data");
                        updateUserLinkedData(process.getUserId(), report);

                        // Step 5: Mark as COMPLETED
                        process.setStatus("COMPLETED");
                        processRepository.save(process);

                        log.info("[Student-Analysis-Processor] Successfully completed processing for process ID: {}",
                                        processId);

                } catch (Exception e) {
                        log.error("[Student-Analysis-Processor] Failed to process analysis for process ID: {}",
                                        processId, e);
                        process.setStatus("FAILED");
                        process.setErrorMessage(e.getMessage());
                        processRepository.save(process);
                }
        }

        /**
         * Update user_linked_data table with strengths and weaknesses
         * Overwrites existing data for the user
         */
        @Transactional
        protected void updateUserLinkedData(String userId, StudentReportData report) {
                // Delete existing strength/weakness data for this user
                userLinkedDataRepository.deleteByUserIdAndTypeIn(userId);

                List<UserLinkedData> dataToSave = new ArrayList<>();

                // Add strengths
                if (report.getStrengths() != null) {
                        for (Map.Entry<String, Integer> entry : report.getStrengths().entrySet()) {
                                UserLinkedData data = new UserLinkedData(
                                                userId,
                                                "strength",
                                                entry.getKey(),
                                                entry.getValue());
                                dataToSave.add(data);
                        }
                }

                // Add weaknesses
                if (report.getWeaknesses() != null) {
                        for (Map.Entry<String, Integer> entry : report.getWeaknesses().entrySet()) {
                                UserLinkedData data = new UserLinkedData(
                                                userId,
                                                "weakness",
                                                entry.getKey(),
                                                entry.getValue());
                                dataToSave.add(data);
                        }
                }

                if (!dataToSave.isEmpty()) {
                        userLinkedDataRepository.saveAll(dataToSave);
                        log.info("[Student-Analysis-Processor] Saved {} user linked data entries", dataToSave.size());
                }
        }
}
