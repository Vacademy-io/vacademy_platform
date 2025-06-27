package vacademy.io.admin_core_service.features.learner_study_library.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerSlidesDetailDTO;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerSubjectProjection;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.module.repository.ModuleChapterMappingRepository;
import vacademy.io.admin_core_service.features.slide.enums.QuestionStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;
import vacademy.io.admin_core_service.features.subject.repository.SubjectPackageSessionRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class LearnerOpenStudyLibraryService {

    @Autowired
    private SubjectPackageSessionRepository subjectPackageSessionRepository;

    @Autowired
    private ModuleChapterMappingRepository moduleChapterMappingRepository;

    @Autowired
    private SlideRepository slideRepository;

    @Autowired
    private ObjectMapper objectMapper;

    public List<LearnerSubjectProjection> getSubjectsByPackageSessionId(String packageSessionId) {
        if (Objects.isNull(packageSessionId)) {
            throw new VacademyException("Please provide packageSessionId");
        }
        return subjectPackageSessionRepository.getSubjectsByPackageSessionId(
            packageSessionId,
            List.of(SubjectStatusEnum.ACTIVE.name())
        );
    }

    public List<LearnerModuleDTOWithDetails> getModulesDetailsWithChapters(String subjectId, String packageSessionId) {
        String rawResponse = moduleChapterMappingRepository.getOpenModuleChapterDetails(
            subjectId,
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


    public List<LearnerSlidesDetailDTO> getLearnerSlides(String chapterId) {
        // Fetch JSON response from repository
        String jsonSlides = slideRepository.getSlidesByChapterIdOpen(
            chapterId,
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
