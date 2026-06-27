package vacademy.io.admin_core_service.features.student_analysis.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.student_analysis.entity.StudentAnalysisProcess;
import vacademy.io.admin_core_service.features.student_analysis.entity.UserLinkedData;
import vacademy.io.admin_core_service.features.student_analysis.repository.StudentAnalysisProcessRepository;
import vacademy.io.admin_core_service.features.student_analysis.repository.UserLinkedDataRepository;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Transactional persistence helper for {@link StudentAnalysisProcessorService}.
 *
 * <p>Exists to avoid the Spring self-invocation proxy problem: {@code @Transactional}
 * on a method called from within the same bean is ignored because the AOP proxy is
 * bypassed.  By placing transactional operations here, every call from the
 * (non-transactional) processor bean goes through the proxy and gets a real transaction.
 *
 * <p>Each public method starts, commits, and releases its connection independently so
 * the long-running async aggregation/LLM work never holds an open DB connection.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentAnalysisPersistenceService {

    private final StudentAnalysisProcessRepository processRepository;
    private final UserLinkedDataRepository userLinkedDataRepository;

    // ─── Status transitions ───────────────────────────────────────────────────

    /**
     * Mark the process as PROCESSING and commit immediately so pollers can see
     * it before the long aggregation work starts.
     */
    @Transactional
    public StudentAnalysisProcess markProcessing(String processId) {
        StudentAnalysisProcess process = processRepository.findById(processId)
                .orElseThrow(() -> new RuntimeException("Process not found: " + processId));
        process.setStatus("PROCESSING");
        return processRepository.save(process);
    }

    /**
     * Persist the completed report JSON and mark the process COMPLETED atomically.
     */
    @Transactional
    public StudentAnalysisProcess saveCompletedReport(String processId, String reportJson) {
        StudentAnalysisProcess process = processRepository.findById(processId)
                .orElseThrow(() -> new RuntimeException("Process not found: " + processId));
        process.setReportJson(reportJson);
        process.setStatus("COMPLETED");
        return processRepository.save(process);
    }

    /**
     * Persist the error message and mark the process FAILED atomically.
     */
    @Transactional
    public void markFailed(String processId, String errorMessage) {
        processRepository.findById(processId).ifPresent(process -> {
            process.setStatus("FAILED");
            process.setErrorMessage(errorMessage);
            processRepository.save(process);
        });
    }

    // ─── User linked data (strengths/weaknesses) ─────────────────────────────

    /**
     * Update the {@code user_linked_data} table with the latest strengths and
     * weaknesses derived from the LLM report.
     *
     * <p>Runs in its own transaction so the {@code flush()} call has an active
     * persistence context.  Deduplication is performed first so the subsequent
     * upserts are always working against a clean slate.
     */
    @Transactional
    public void updateUserLinkedData(String userId,
                                     Map<String, Integer> strengths,
                                     Map<String, Integer> weaknesses) {
        // Remove duplicates first so subsequent lookups are unambiguous
        cleanDuplicates(userId, "strength");
        cleanDuplicates(userId, "weakness");

        // Flush deduplication deletes before running the upserts
        userLinkedDataRepository.flush();

        if (strengths != null) {
            strengths.forEach((data, percentage) -> {
                String trimmedData = data.trim();
                UserLinkedData existing = userLinkedDataRepository
                        .findByUserIdAndTypeAndData(userId, "strength", trimmedData);
                if (existing != null) {
                    existing.setData(trimmedData);
                    existing.setPercentage(percentage);
                    userLinkedDataRepository.save(existing);
                } else {
                    userLinkedDataRepository.save(
                            new UserLinkedData(userId, "strength", trimmedData, percentage));
                }
            });
        }

        if (weaknesses != null) {
            weaknesses.forEach((data, percentage) -> {
                String trimmedData = data.trim();
                UserLinkedData existing = userLinkedDataRepository
                        .findByUserIdAndTypeAndData(userId, "weakness", trimmedData);
                if (existing != null) {
                    existing.setData(trimmedData);
                    existing.setPercentage(percentage);
                    userLinkedDataRepository.save(existing);
                } else {
                    userLinkedDataRepository.save(
                            new UserLinkedData(userId, "weakness", trimmedData, percentage));
                }
            });
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * For a given user+type, keep only the entry with the highest percentage per
     * normalised data string; delete the rest.  Called from within
     * {@link #updateUserLinkedData} which is already {@code @Transactional}.
     */
    private void cleanDuplicates(String userId, String type) {
        List<UserLinkedData> all = userLinkedDataRepository.findByUserIdAndType(userId, type);

        Map<String, List<UserLinkedData>> grouped = all.stream()
                .collect(Collectors.groupingBy(ud -> ud.getData().trim().toLowerCase()));

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
