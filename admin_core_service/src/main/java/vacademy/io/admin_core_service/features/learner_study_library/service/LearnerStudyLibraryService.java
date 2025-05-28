package vacademy.io.admin_core_service.features.learner_study_library.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDetailsProjection;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.course.dto.CourseDTOWithDetails;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerSlidesDetailDTO;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerSubjectProjection;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.module.repository.ModuleChapterMappingRepository;
import vacademy.io.admin_core_service.features.module.repository.SubjectModuleMappingRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideDetailProjection;
import vacademy.io.admin_core_service.features.slide.enums.QuestionStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.admin_core_service.features.slide.service.SlideService;
import vacademy.io.admin_core_service.features.study_library.service.StudyLibraryService;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;
import vacademy.io.admin_core_service.features.subject.repository.SubjectPackageSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.SubjectDTO;
import vacademy.io.common.institute.entity.module.Module;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class LearnerStudyLibraryService {

    private final PackageRepository packageRepository;
    private final StudyLibraryService studyLibraryService;
    private final SlideRepository slideRepository;
    private final SubjectPackageSessionRepository subjectPackageSessionRepository;
    private final SubjectModuleMappingRepository subjectModuleMappingRepository;
    private final ModuleChapterMappingRepository moduleChapterMappingRepository;
    private final SlideService slideService;
    private final ObjectMapper objectMapper;

    public List<CourseDTOWithDetails> getLearnerStudyLibraryInitDetails(String instituteId, String packageSessionId, CustomUserDetails user) {
        validateInputs(instituteId, user.getUserId());

        return packageRepository.findDistinctPackagesByUserIdAndInstituteId(user.getUserId(), instituteId)
                .stream()
                .map(packageEntity -> studyLibraryService.buildCourseDTOWithDetails(packageEntity, instituteId))
                .toList();
    }

    private void validateInputs(String instituteId, String userId) {
        if (Objects.isNull(instituteId)) {
            throw new VacademyException("Please provide instituteId");
        }
        if (Objects.isNull(userId)) {
            throw new VacademyException("Please provide userId");
        }
    }

    public List<LearnerModuleDTOWithDetails> getModulesDetailsWithChapters(String subjectId, String packageSessionId,CustomUserDetails user) {
        String rawResponse = moduleChapterMappingRepository.getModuleChapterProgress(
                subjectId,
                packageSessionId,
                user.getUserId(),
                List.of(SlideStatus.PUBLISHED.name(),SlideStatus.UNSYNC.name()),
                List.of(SlideStatus.PUBLISHED.name(),SlideStatus.UNSYNC.name()),
                List.of(ChapterStatus.ACTIVE.name()),
                List.of(ModuleStatusEnum.ACTIVE.name())
        );
        return mapToLearnerModuleDTOWithDetails(rawResponse);
    }

    private List<LearnerModuleDTOWithDetails> mapToLearnerModuleDTOWithDetails(String rawJson) {
        if (!StringUtils.hasText(rawJson)) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(
                    rawJson,
                    List.class
            );
        } catch (Exception e) {
            throw new VacademyException("Error parsing module JSON response. "+e.getMessage());
        }
    }
    public List<SlideDetailProjection> getSlidesByChapterId(String chapterId, CustomUserDetails user) {
        return slideRepository.findLearnerSlideDetailsByChapterId(chapterId, List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()));
    }

    public List<LearnerSubjectProjection> getSubjectsByPackageSessionId(String packageSessionId, CustomUserDetails user) {
        if (Objects.isNull(packageSessionId)) {
            throw new VacademyException("Please provide packageSessionId");
        }
        return subjectPackageSessionRepository.findLearnerSubjectsWithFilters(
                packageSessionId,
                user.getUserId(),
                List.of(SubjectStatusEnum.ACTIVE.name()),
                List.of(ModuleStatusEnum.ACTIVE.name()),
                        List.of(ChapterStatus.ACTIVE.name()),
                List.of(ChapterStatus.ACTIVE.name()));
    }

    public List<LearnerSlidesDetailDTO> getLearnerSlides(String chapterId, CustomUserDetails user) {
        // Fetch JSON response from repository
        String jsonSlides = slideRepository.getSlidesByChapterId(
                chapterId,
                user.getUserId(),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(QuestionStatusEnum.ACTIVE.name()) // Added missing closing parenthesis here
        );

        // Map the JSON to List<SlideDTO>
        return mapToSlideDTOList(jsonSlides);
    }

    public List<LearnerSlidesDetailDTO> mapToSlideDTOList(String jsonSlides) {
        if (!StringUtils.hasText(jsonSlides)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(jsonSlides, new TypeReference<List<LearnerSlidesDetailDTO>>() {});
        } catch (Exception e) {
            throw new VacademyException("Unable to map to SlideDTO list: " + e.getMessage());
        }
    }
}