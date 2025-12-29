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
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
                        updateUserLinkedData(process.getUserId(), report.getStrengths(), report.getWeaknesses());

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
         * Cleans duplicates and updates or creates entries as needed
         */
        @Transactional
        protected void updateUserLinkedData(String userId, Map<String, Integer> strengths,
                        Map<String, Integer> weaknesses) {
                // Clean duplicates for strengths
                cleanDuplicates(userId, "strength");

                // Clean duplicates for weaknesses
                cleanDuplicates(userId, "weakness");

                // Update or add strengths
                if (strengths != null) {
                        // Flush any pending changes before processing
                        userLinkedDataRepository.flush();

                        strengths.forEach((data, percentage) -> {
                                String trimmedData = data.trim();
                                UserLinkedData existing = userLinkedDataRepository.findByUserIdAndTypeAndData(userId,
                                                "strength", trimmedData);

                                if (existing != null) {
                                        existing.setData(trimmedData);
                                        existing.setPercentage(percentage);
                                        userLinkedDataRepository.save(existing);
                                } else {
                                        // Create new entry
                                        UserLinkedData newEntry = new UserLinkedData(userId, "strength", trimmedData,
                                                        percentage);
                                        userLinkedDataRepository.save(newEntry);
                                }
                        });
                }

                // Update or add weaknesses
                if (weaknesses != null) {
                        weaknesses.forEach((data, percentage) -> {
                                String trimmedData = data.trim();
                                UserLinkedData existing = userLinkedDataRepository.findByUserIdAndTypeAndData(userId,
                                                "weakness", trimmedData);

                                if (existing != null) {
                                        existing.setData(trimmedData);
                                        existing.setPercentage(percentage);
                                        userLinkedDataRepository.save(existing);
                                } else {
                                        UserLinkedData newEntry = new UserLinkedData(userId, "weakness", trimmedData,
                                                        percentage);
                                        userLinkedDataRepository.save(newEntry);
                                }
                        });
                }
        }

        /**
         * Clean duplicate entries for a given user and type
         * Keeps the entry with the highest percentage
         */
        private void cleanDuplicates(String userId, String type) {
                List<UserLinkedData> all = userLinkedDataRepository.findByUserIdAndType(userId, type);

                // Group by normalized data (case-insensitive)
                Map<String, List<UserLinkedData>> grouped = all.stream()
                                .collect(Collectors.groupingBy(ud -> ud.getData().trim().toLowerCase()));

                // For each group with duplicates, keep the one with max percentage and delete
                // others
                grouped.values().stream()
                                .filter(group -> group.size() > 1)
                                .forEach(group -> {
                                        UserLinkedData keep = group.stream()
                                                        .max(Comparator.comparingInt(UserLinkedData::getPercentage))
                                                        .orElse(group.get(0));

                                        group.stream()
                                                        .filter(ud -> !ud.getId().equals(keep.getId()))
                                                        .forEach(userLinkedDataRepository::delete);
                                });
        }
}
