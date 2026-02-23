package vacademy.io.admin_core_service.features.module.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationEnum;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.module.repository.ModuleChapterMappingRepository;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LearnerModuleDetailsService {
    private final ModuleChapterMappingRepository moduleChapterMappingRepository;
    private final ObjectMapper objectMapper;

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<LearnerModuleDTOWithDetails> getModulesDetailsWithChapters(String subjectId, String packageSessionId,
            String userId, CustomUserDetails user) {
        String rawResponse = moduleChapterMappingRepository.getModuleChapterProgress(
                subjectId,
                packageSessionId,
                user.getUserId(),
                LearnerOperationEnum.PERCENTAGE_MODULE_COMPLETED.name(),
                LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name(),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus.ACTIVE.name()),
                List.of(ModuleStatusEnum.ACTIVE.name()));
        List<LearnerModuleDTOWithDetails> modules = mapToLearnerModuleDTOWithDetails(rawResponse);
        return modules;
    }

    private List<LearnerModuleDTOWithDetails> mapToLearnerModuleDTOWithDetails(String rawJson) {
        if (rawJson == null || rawJson.trim().isEmpty()) {
            return new java.util.ArrayList<>();
        }
        try {
            return objectMapper.readValue(
                    rawJson,
                    objectMapper.getTypeFactory().constructCollectionType(List.class,
                            LearnerModuleDTOWithDetails.class));
        } catch (Exception e) {
            throw new VacademyException("Error parsing module JSON response");
        }
    }

}
