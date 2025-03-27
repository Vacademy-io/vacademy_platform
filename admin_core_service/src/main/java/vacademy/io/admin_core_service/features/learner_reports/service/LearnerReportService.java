package vacademy.io.admin_core_service.features.learner_reports.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.util.logging.Logger;
import java.util.stream.Collectors;

@Service
public class LearnerReportService {

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @Autowired
    private ConcentrationScoreRepository concentrationScoreRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();


    private static final List<String> ACTIVE_LEARNERS = List.of(LearnerStatusEnum.ACTIVE.name());
    private static final List<String> ACTIVE_SUBJECTS = List.of(SubjectStatusEnum.ACTIVE.name());
    private static final List<String> ACTIVE_MODULES = List.of(ModuleStatusEnum.ACTIVE.name());
    private static final List<String> ACTIVE_CHAPTERS = List.of(ChapterStatus.ACTIVE.name());
    private static final List<String> VALID_SLIDE_STATUSES = List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name());


    public ProgressReportDTO getLearnerProgressReport(ReportFilterDTO filterDTO, CustomUserDetails userDetails){
        validateBatchReportFilter(filterDTO);
        return new ProgressReportDTO(
                getPercentageCourseCompleted(filterDTO),
                getAverageTimeSpent(filterDTO),
                getAverageConcentrationScore(filterDTO),
                getTimeSpentEachDay(filterDTO)
        );
    }

    private List<AvgDailyTimeSpentDTO> getTimeSpentEachDay(ReportFilterDTO filter) {
        return activityLogRepository.getTimeSpentByLearnerPerDay(
                        filter.getStartDate().toString(),
                        filter.getEndDate().toString(),
                        filter.getUserId()
                )
                .stream()
                .map(row -> new AvgDailyTimeSpentDTO(row[0].toString(), ((Number) row[1]).doubleValue()))
                .collect(Collectors.toList());
    }

    private Double getAverageTimeSpent(ReportFilterDTO filter) {
        return activityLogRepository.findTimeSpentByLearner(
                filter.getStartDate(),
                filter.getEndDate(),
                filter.getUserId()
        );
    }

    private Double getPercentageCourseCompleted(ReportFilterDTO filter) {
        return activityLogRepository.getLearnerCourseCompletionPercentage(
                filter.getPackageSessionId(),
                filter.getUserId(),
                filter.getStartDate(),
                filter.getEndDate(),
                ACTIVE_SUBJECTS,
                ACTIVE_MODULES,
                ACTIVE_CHAPTERS,
                VALID_SLIDE_STATUSES
        );
    }

    private void validateBatchReportFilter(ReportFilterDTO filter) {
        if (Objects.isNull(filter.getStartDate()) || Objects.isNull(filter.getEndDate())) {
            throw new VacademyException("Please provide start date and end date");
        }
        if (!StringUtils.hasText(filter.getPackageSessionId())) {
            throw new VacademyException("Please provide package session id");
        }
    }

    private Double getAverageConcentrationScore(ReportFilterDTO filter) {
        return concentrationScoreRepository.findAverageConcentrationScoreOfLearner(
                filter.getStartDate(),
                filter.getEndDate(),
                filter.getUserId()
        );
    }

    public List<SubjectProgressDTO> getSubjectProgressReport(String packageSessionId, String userId, CustomUserDetails userDetails) {
        return activityLogRepository.getModuleCompletionByUser(
                        packageSessionId,
                        userId,
                        ACTIVE_SUBJECTS,
                        ACTIVE_MODULES,
                        ACTIVE_CHAPTERS,
                        VALID_SLIDE_STATUSES,
                        VALID_SLIDE_STATUSES)
                .stream()
                .map(this::mapToSubjectProgressDTO)
                .collect(Collectors.toList());
    }

    private SubjectProgressDTO mapToSubjectProgressDTO(Object[] result) {
        try {
            SubjectProgressDTO dto = new SubjectProgressDTO();
            dto.setSubjectId((String) result[0]); // subject_id
            dto.setSubjectName((String) result[1]); // subject_name

            // Convert JSON string (modules) to List<ModuleProgressDTO>
            String modulesJson = (String) result[2];
            List<SubjectProgressDTO.ModuleProgressDTO> modules = objectMapper.readValue(
                    modulesJson, new TypeReference<>() {});

            dto.setModules(modules);
            return dto;
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to parse module progress data", e);
        }
    }

    public List<ChapterSlideProgressDTO> getChapterSlideProgress(String moduleId,String userId, CustomUserDetails userDetails) {
        return activityLogRepository.getChapterSlideProgressForLearner(
                        moduleId, userId, ACTIVE_CHAPTERS, ACTIVE_CHAPTERS, VALID_SLIDE_STATUSES, VALID_SLIDE_STATUSES)
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
                    projection.getSlides(), new TypeReference<>() {});
            dto.setSlides(slides);

            return dto;
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to parse slides data", e);
        }
    }

}
