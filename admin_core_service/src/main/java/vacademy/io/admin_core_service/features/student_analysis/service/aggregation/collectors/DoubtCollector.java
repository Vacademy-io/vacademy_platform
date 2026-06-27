package vacademy.io.admin_core_service.features.student_analysis.service.aggregation.collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.doubts.entity.Doubts;
import vacademy.io.admin_core_service.features.doubts.repository.DoubtsRepository;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.DoubtsAndEngagementSection;

import java.time.LocalDate;
import java.util.Date;
import java.util.List;

/**
 * Collects doubts raised/resolved counts for a student in the report window.
 * Uses the existing DoubtsRepository.findDoubtsWithFilter (READ-ONLY).
 * Returns a {@link DoubtsAndEngagementSection} (v2 rename from DoubtsSection).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DoubtCollector {

    private final DoubtsRepository doubtsRepository;

    public DoubtsAndEngagementSection collect(String userId, String instituteId, LocalDate startDate, LocalDate endDate) {
        try {
            Date start = java.sql.Date.valueOf(startDate);
            Date end = java.sql.Date.valueOf(endDate);

            Page<Doubts> page = doubtsRepository.findDoubtsWithFilter(
                    null, null, null, null, null,
                    List.of(userId),
                    null,
                    instituteId,
                    List.of(), false,
                    start, end,
                    PageRequest.of(0, 1000));

            List<Doubts> doubts = page.getContent();

            int questionsAsked = doubts.size();
            int resolved = 0;
            long totalResolutionMillis = 0;
            int resolvedWithTime = 0;

            for (Doubts d : doubts) {
                if ("RESOLVED".equalsIgnoreCase(d.getStatus())) {
                    resolved++;
                    if (d.getRaisedTime() != null && d.getResolvedTime() != null) {
                        long diffMs = d.getResolvedTime().getTime() - d.getRaisedTime().getTime();
                        if (diffMs > 0) {
                            totalResolutionMillis += diffMs;
                            resolvedWithTime++;
                        }
                    }
                }
            }

            double avgHours = resolvedWithTime > 0
                    ? Math.round((totalResolutionMillis / (double) resolvedWithTime / 3_600_000.0) * 100.0) / 100.0
                    : 0.0;

            return DoubtsAndEngagementSection.builder()
                    .available(true)
                    .questionsAsked(questionsAsked)
                    .resolved(resolved)
                    .avgResolutionHours(avgHours)
                    .note(null)  // LLM sets this
                    .build();

        } catch (Exception e) {
            log.error("[DoubtCollector] Failed for userId={}: {}", userId, e.getMessage());
            return DoubtsAndEngagementSection.builder().available(false).build();
        }
    }
}
