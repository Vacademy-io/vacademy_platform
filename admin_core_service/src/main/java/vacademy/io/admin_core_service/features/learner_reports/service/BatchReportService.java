package vacademy.io.admin_core_service.features.learner_reports.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.learner_operation.repository.LearnerOperationRepository;
import vacademy.io.admin_core_service.features.learner_reports.dto.*;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ConcentrationScoreRepository;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BatchReportService {

    private static final List<String> ACTIVE_LEARNERS = List.of(LearnerStatusEnum.ACTIVE.name());
    private static final List<String> ACTIVE_SUBJECTS = List.of(SubjectStatusEnum.ACTIVE.name());
    private static final List<String> ACTIVE_MODULES = List.of(ModuleStatusEnum.ACTIVE.name());
    private static final List<String> ACTIVE_CHAPTERS = List.of(ChapterStatus.ACTIVE.name());
    private static final List<String> VALID_SLIDE_STATUSES = List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name());
    private static final List<String> SLIDE_TYPES = List.of(SlideTypeEnum.VIDEO.name(),SlideTypeEnum.DOCUMENT.name());

    private final ActivityLogRepository activityLogRepository;
    private final ConcentrationScoreRepository concentrationScoreRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final LearnerOperationRepository learnerOperationRepository;

    public ProgressReportDTO getBatchReport(ReportFilterDTO filter, CustomUserDetails userDetails) {
        validateBatchReportFilter(filter);
        return new ProgressReportDTO(
                getPercentageCourseCompleted(filter),
                getAverageTimeSpent(filter),
                getAverageConcentrationScore(filter),
                getAvgTimeSpent(filter)
        );
    }

    public Page<LearnerActivityDataProjection> getBatchActivityData(ReportFilterDTO filter, Integer pageNo, Integer pageSize, CustomUserDetails userDetails) {
        return activityLogRepository.getBatchActivityDataWithRankPaginated(
                filter.getStartDate(),
                filter.getEndDate(),
                filter.getPackageSessionId(),
                ACTIVE_LEARNERS,
                PageRequest.of(pageNo, pageSize)
        );
    }

    private Double getPercentageCourseCompleted(ReportFilterDTO filter) {
        return activityLogRepository.getBatchCourseCompletionPercentagePerLearner(
                filter.getPackageSessionId(),
                filter.getStartDate(),
                filter.getEndDate(),
                ACTIVE_SUBJECTS,
                ACTIVE_MODULES,
                ACTIVE_CHAPTERS,
                ACTIVE_CHAPTERS,
                VALID_SLIDE_STATUSES,
                SLIDE_TYPES,
                ACTIVE_LEARNERS
        );
    }

    private Double getAverageConcentrationScore(ReportFilterDTO filter) {
        return concentrationScoreRepository.findAverageConcentrationScoreByBatch(
                filter.getStartDate(),
                filter.getEndDate(),
                filter.getPackageSessionId(),
                ACTIVE_LEARNERS
        );
    }

    private Double getAverageTimeSpent(ReportFilterDTO filter) {
        return activityLogRepository.findAverageTimeSpentByBatch(
                filter.getStartDate(),
                filter.getEndDate(),
                filter.getPackageSessionId(),
                ACTIVE_LEARNERS,
                ACTIVE_SUBJECTS,
                ACTIVE_MODULES,
                ACTIVE_CHAPTERS,
                ACTIVE_CHAPTERS,
                VALID_SLIDE_STATUSES
        );
    }

    private List<AvgDailyTimeSpentDTO> getAvgTimeSpent(ReportFilterDTO filter) {
        return activityLogRepository.getAvgTimeSpentPerStudent(
                        filter.getStartDate().toString(),
                        filter.getEndDate().toString(),
                        filter.getPackageSessionId(),
                        ACTIVE_LEARNERS)
                .stream()
                .map(row -> new AvgDailyTimeSpentDTO(row[0].toString(), ((Number) row[1]).doubleValue()))
                .collect(Collectors.toList());
    }

    private void validateBatchReportFilter(ReportFilterDTO filter) {
        if (Objects.isNull(filter.getStartDate()) || Objects.isNull(filter.getEndDate())) {
            throw new VacademyException("Please provide start date and end date");
        }
        if (!StringUtils.hasText(filter.getPackageSessionId())) {
            throw new VacademyException("Please provide package session id");
        }
    }

    public List<SubjectProgressDTO> getSubjectProgressReport(String packageSessionId, CustomUserDetails userDetails) {
        return activityLogRepository.getModuleCompletionAndTimeSpent(
                        packageSessionId, ACTIVE_SUBJECTS, ACTIVE_MODULES, ACTIVE_CHAPTERS, VALID_SLIDE_STATUSES, VALID_SLIDE_STATUSES, ACTIVE_LEARNERS)
                .stream()
                .map(this::mapToSubjectProgressDTO)
                .collect(Collectors.toList());
    }

    private SubjectProgressDTO mapToSubjectProgressDTO(SubjectProgressProjection projection) {
        try {
            SubjectProgressDTO dto = new SubjectProgressDTO();
            dto.setSubjectId(projection.getSubjectId());
            dto.setSubjectName(projection.getSubjectName());
            log.info("Processing subject: {}", projection.getSubjectName());

            List<SubjectProgressDTO.ModuleProgressDTO> modules = objectMapper.readValue(
                    projection.getModules(), new TypeReference<>() {
                    });
            dto.setModules(modules);
            return dto;
        } catch (JsonProcessingException e) {
            log.error("Failed to parse module progress data", e);
            throw new RuntimeException("Failed to parse module progress data", e);
        }
    }

    public List<ChapterSlideProgressDTO> getChapterSlideProgress(String moduleId, String packageSessionId, CustomUserDetails userDetails) {
        return activityLogRepository.getChapterSlideProgress(
                        moduleId, packageSessionId, ACTIVE_CHAPTERS, ACTIVE_CHAPTERS, VALID_SLIDE_STATUSES, VALID_SLIDE_STATUSES, ACTIVE_LEARNERS)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    private ChapterSlideProgressDTO mapToDTO(ChapterSlideProgressProjection projection) {
        try {
            ChapterSlideProgressDTO dto = new ChapterSlideProgressDTO();
            dto.setChapterId(projection.getChapterId());
            dto.setChapterName(projection.getChapterName());

            List<ChapterSlideProgressDTO.SlideProgressDTO> slides = objectMapper.readValue(
                    projection.getSlides(), new TypeReference<>() {
                    });
            dto.setSlides(slides);

            return dto;
        } catch (JsonProcessingException e) {
            log.error("Failed to parse slides data", e);
            throw new RuntimeException("Failed to parse slides data", e);
        }
    }

    public List<LearnerActivityDataProjection> getBatchActivityDataLeaderBoard(ReportFilterDTO filter, CustomUserDetails userDetails) {
        // Simply call the method to retrieve all records (no pagination)
        return activityLogRepository.getBatchActivityDataWithRank(
                filter.getStartDate(),
                filter.getEndDate(),
                filter.getPackageSessionId(),
                ACTIVE_LEARNERS
        );
    }
}
