package vacademy.io.admin_core_service.features.learner_reports.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.learner_reports.dto.*;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ConcentrationScoreRepository;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class BatchReportService {

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @Autowired
    private ConcentrationScoreRepository concentrationScoreRepository;

    /**
     * Generates a batch report based on the provided filters.
     */
    public BatchReportDTO getBatchReport(BatchReportFilterDTO batchReportFilterDTO, CustomUserDetails userDetails) {
        validateBatchReportFilter(batchReportFilterDTO);

        return new BatchReportDTO(
                getPercentageCourseCompleted(batchReportFilterDTO),
                getAverageTimeSpent(batchReportFilterDTO),
                getAverageConcentrationScore(batchReportFilterDTO),
                getAvgTimeSpent(batchReportFilterDTO)
        );
    }

    /**
     * Retrieves paginated learner activity data.
     */
    public Page<LearnerActivityDataProjection> getBatchActivityData(
            BatchReportFilterDTO batchReportFilterDTO, Integer pageNo, Integer pageSize, CustomUserDetails userDetails) {
        return activityLogRepository.getBatchActivityDataWithRankPaginated(
                batchReportFilterDTO.getStartDate(),
                batchReportFilterDTO.getEndDate(),
                batchReportFilterDTO.getPackageSessionId(),
                List.of(LearnerStatusEnum.ACTIVE.name()),
                PageRequest.of(pageNo, pageSize)
        );
    }

    /**
     * Fetches the percentage of course completed by the batch.
     */
    private Double getPercentageCourseCompleted(BatchReportFilterDTO batchReportFilterDTO) {
        return activityLogRepository.getBatchCourseCompletionPercentage(
                batchReportFilterDTO.getPackageSessionId(),
                batchReportFilterDTO.getStartDate(),
                batchReportFilterDTO.getEndDate(),
                List.of(SubjectStatusEnum.ACTIVE.name()),
                List.of(ModuleStatusEnum.ACTIVE.name()),
                List.of(ChapterStatus.ACTIVE.name()),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name())
        );
    }

    /**
     * Fetches the average concentration score of the batch.
     */
    private Double getAverageConcentrationScore(BatchReportFilterDTO batchReportFilterDTO) {
        return concentrationScoreRepository.findAverageConcentrationScoreByBatch(
                batchReportFilterDTO.getStartDate(),
                batchReportFilterDTO.getEndDate(),
                batchReportFilterDTO.getPackageSessionId(),
                List.of(LearnerStatusEnum.ACTIVE.name())
        );
    }

    /**
     * Fetches the average time spent by the batch.
     */
    private Double getAverageTimeSpent(BatchReportFilterDTO batchReportFilterDTO) {
        return activityLogRepository.findAverageTimeSpentByBatch(
                batchReportFilterDTO.getStartDate(),
                batchReportFilterDTO.getEndDate(),
                batchReportFilterDTO.getPackageSessionId(),
                List.of(LearnerStatusEnum.ACTIVE.name())
        );
    }

    /**
     * Retrieves daily learner time spent by batch.
     */
    private List<BatchAvgDailyTimeSpentDTO> getAvgTimeSpent(BatchReportFilterDTO batchReportFilterDTO) {
        List<Object[]> rawData = activityLogRepository.getBatchAvgDailyTimeSpent(
                batchReportFilterDTO.getStartDate().toString(),
                batchReportFilterDTO.getEndDate().toString(),
                batchReportFilterDTO.getPackageSessionId(),
                List.of(LearnerStatusEnum.ACTIVE.name())
        );
        return parseBatchAvgDailyTimeSpent(rawData);
    }

    /**
     * Converts raw query result to DTO list.
     */
    private List<BatchAvgDailyTimeSpentDTO> parseBatchAvgDailyTimeSpent(List<Object[]> resultSet) {
        return resultSet.stream()
                .map(row -> new BatchAvgDailyTimeSpentDTO(
                        row[0].toString(),  // Convert SQL Date to LocalDate
                        ((Number) row[1]).doubleValue()  // Convert Number to Double
                ))
                .collect(Collectors.toList());
    }

    /**
     * Validates the batch report filter parameters.
     */
    private void validateBatchReportFilter(BatchReportFilterDTO batchReportFilterDTO) {
        if (Objects.isNull(batchReportFilterDTO.getStartDate()) || Objects.isNull(batchReportFilterDTO.getEndDate())) {
            throw new VacademyException("Please provide start date and end date");
        }
        if (!StringUtils.hasText(batchReportFilterDTO.getPackageSessionId())) {
            throw new VacademyException("Please provide package session id");
        }
    }
}
