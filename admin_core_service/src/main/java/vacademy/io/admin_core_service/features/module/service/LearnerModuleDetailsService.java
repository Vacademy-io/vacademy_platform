package vacademy.io.admin_core_service.features.module.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDetailsProjection;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;
import vacademy.io.admin_core_service.features.module.repository.ModuleChapterMappingRepository;
import vacademy.io.admin_core_service.features.module.repository.SubjectModuleMappingRepository;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.module.Module;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class LearnerModuleDetailsService {
    private final SubjectModuleMappingRepository subjectModuleMappingRepository;
    private final ModuleChapterMappingRepository moduleChapterMappingRepository;

    public List<LearnerModuleDTOWithDetails> getModulesDetailsWithChapters(String subjectId, String packageSessionId, String userId, CustomUserDetails user) {
        if (Objects.isNull(subjectId)) {
            throw new VacademyException("Please provide subjectId");
        }
        List<Module> modules = subjectModuleMappingRepository.findModulesBySubjectIdAndPackageSessionId(subjectId, packageSessionId);
        List<LearnerModuleDTOWithDetails> moduleDTOWithDetails = new ArrayList<>();
        for (Module module : modules) {
            List<ChapterDetailsProjection> chapters = moduleChapterMappingRepository.getChapterDetails(module.getId(), packageSessionId, userId, List.of(SlideStatus.PUBLISHED.name()));
            LearnerModuleDTOWithDetails moduleDTOWithDetails1 = new LearnerModuleDTOWithDetails(new ModuleDTO(module), chapters);
            moduleDTOWithDetails.add(moduleDTOWithDetails1);
        }
        return moduleDTOWithDetails;
    }

}
