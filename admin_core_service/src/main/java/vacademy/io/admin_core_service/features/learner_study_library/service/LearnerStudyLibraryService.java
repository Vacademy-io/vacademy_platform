package vacademy.io.admin_core_service.features.learner_study_library.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTOWithDetail;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.course.dto.CourseDTOWithDetails;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.slide.dto.SlideDetailProjection;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.admin_core_service.features.study_library.dto.ModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.service.StudyLibraryService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
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

    public List<ModuleDTOWithDetails> getModulesDetailsWithChapters(String subjectId, String packageSessionId, CustomUserDetails user) {
        return studyLibraryService.getModulesDetailsWithChapters(subjectId, packageSessionId, user);
    }

    public List<SlideDetailProjection> getSlidesByChapterId(String chapterId, CustomUserDetails user) {
        return slideRepository.findSlideDetailsByChapterId(chapterId,List.of(SlideStatus.PUBLISHED.name()));
    }
}