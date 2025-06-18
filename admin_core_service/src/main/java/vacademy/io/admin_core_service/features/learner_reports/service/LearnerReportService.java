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
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class LearnerReportService {

    private static final List<String> ACTIVE_LEARNERS = List.of(LearnerStatusEnum.ACTIVE.name());
    private static final List<String> ACTIVE_SUBJECTS = List.of(SubjectStatusEnum.ACTIVE.name());
    private static final List<String> ACTIVE_MODULES = List.of(ModuleStatusEnum.ACTIVE.name());
    private static final List<String> ACTIVE_CHAPTERS = List.of(ChapterStatus.ACTIVE.name());
    private static final List<String> VALID_SLIDE_STATUSES = List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name());
    private static final List<String> SLIDE_TYPES = List.of(SlideTypeEnum.VIDEO.name(),SlideTypeEnum.DOCUMENT.name());
    private final ObjectMapper objectMapper = new ObjectMapper();
    @Autowired
    private ActivityLogRepository activityLogRepository;
    @Autowired
    private ConcentrationScoreRepository concentrationScoreRepository;

    public ProgressReportDTO getLearnerProgressReport(ReportFilterDTO filterDTO, CustomUserDetails userDetails) {
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
                VALID_SLIDE_STATUSES,
                SLIDE_TYPES,
                ACTIVE_CHAPTERS
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

    public List<LearnerSubjectWiseProgressReportDTO> getSubjectProgressReport(String packageSessionId, String userId, CustomUserDetails userDetails) {
        return activityLogRepository.getModuleCompletionByUserAndBatch(
                        packageSessionId,
                        userId,
                        ACTIVE_SUBJECTS,
                        ACTIVE_MODULES,
                        ACTIVE_CHAPTERS,
                        VALID_SLIDE_STATUSES,
                        VALID_SLIDE_STATUSES,
                        ACTIVE_LEARNERS)
                .stream()
                .map(this::mapToSubjectProgressDTO)
                .collect(Collectors.toList());
    }

    private LearnerSubjectWiseProgressReportDTO mapToSubjectProgressDTO(Object[] result) {
        try {
            LearnerSubjectWiseProgressReportDTO dto = new LearnerSubjectWiseProgressReportDTO();
            dto.setSubjectId((String) result[0]); // subject_id
            dto.setSubjectName((String) result[1]); // subject_name

            // Convert JSON string (modules) to List<ModuleProgressDTO>
            String modulesJson = (String) result[2];
            List<LearnerSubjectWiseProgressReportDTO.ModuleProgressDTO> modules = objectMapper.readValue(
                    modulesJson, new TypeReference<>() {
                    });

            dto.setModules(modules);
            return dto;
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to parse module progress data", e);
        }
    }

    public List<LearnerChapterSlideProgressDTO> getChapterSlideProgress(String moduleId, String userId, String packageSessionId, CustomUserDetails userDetails) {
        return activityLogRepository.getChapterSlideProgressCombined(
                        moduleId,
                        packageSessionId,
                        userId,
                        ACTIVE_CHAPTERS,
                        ACTIVE_CHAPTERS,
                        VALID_SLIDE_STATUSES,
                        VALID_SLIDE_STATUSES,
                        ACTIVE_LEARNERS)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    private LearnerChapterSlideProgressDTO mapToDTO(ChapterSlideProgressProjection projection) {
        try {
            LearnerChapterSlideProgressDTO dto = new LearnerChapterSlideProgressDTO();
            dto.setChapterId(projection.getChapterId());
            dto.setChapterName(projection.getChapterName());

            List<LearnerChapterSlideProgressDTO.SlideProgressDTO> slides = objectMapper.readValue(
                    projection.getSlides(), new TypeReference<>() {
                    });
            dto.setSlides(slides);

            return dto;
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to parse slides data", e);
        }
    }

    public List<SlideProgressDateWiseDTO> getSlideProgressForLearner(ReportFilterDTO filterDTO, CustomUserDetails userDetails) {
        List<Object[]> rawResults = activityLogRepository.getSlideActivityByDate(
                filterDTO.getPackageSessionId(),
                filterDTO.getUserId(),
                filterDTO.getStartDate(),
                filterDTO.getEndDate(),
                ACTIVE_SUBJECTS,
                ACTIVE_MODULES,
                ACTIVE_CHAPTERS,
                VALID_SLIDE_STATUSES
        );

        List<SlideProgressDateWiseDTO> progressList = new ArrayList<>();
        ObjectMapper objectMapper = new ObjectMapper();

        for (Object[] row : rawResults) {
            try {
                String date = row[0].toString();  // Extract date
                String jsonString = row[1].toString();  // Extract JSON string

                List<SlideProgressDTO> slideDetails = objectMapper.readValue(
                        jsonString, new TypeReference<List<SlideProgressDTO>>() {
                        }
                );

                progressList.add(new SlideProgressDateWiseDTO(date, slideDetails));
            } catch (JsonProcessingException e) {
                e.printStackTrace(); // Log properly
            }
        }

        return progressList;
    }

}
