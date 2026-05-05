package vacademy.io.admin_core_service.features.slide.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.slide.dto.AssessmentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.entity.AssessmentSlide;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.AssessmentSlideRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.UUID;

@Service
public class AssessmentSlideService {

    @Autowired
    private SlideService slideService;

    @Autowired
    private AssessmentSlideRepository assessmentSlideRepository;

    @Transactional
    public String addOrUpdateAssessmentSlide(SlideDTO slideDTO, String chapterId, String packageSessionId,
            String moduleId, String subjectId, CustomUserDetails userDetails) {
        if (slideDTO.isNewSlide()) {
            return addAssessmentSlide(slideDTO, chapterId);
        }
        return updateAssessmentSlide(slideDTO, chapterId, packageSessionId, moduleId, subjectId);
    }

    public String addAssessmentSlide(SlideDTO slideDTO, String chapterId) {
        AssessmentSlideDTO dto = slideDTO.getAssessmentSlide();
        if (dto == null || dto.getAssessmentId() == null || dto.getAssessmentId().isBlank()) {
            throw new VacademyException("assessment_id is required for an assessment slide");
        }

        AssessmentSlide assessmentSlide = new AssessmentSlide(dto);
        if (assessmentSlide.getId() == null || assessmentSlide.getId().isBlank()) {
            assessmentSlide.setId(UUID.randomUUID().toString());
        }
        AssessmentSlide saved = assessmentSlideRepository.save(assessmentSlide);

        return slideService.saveSlide(
                slideDTO.getId(),
                saved.getId(),
                SlideTypeEnum.ASSESSMENT.name(),
                slideDTO.getStatus(),
                slideDTO.getTitle(),
                slideDTO.getDescription(),
                slideDTO.getImageFileId(),
                slideDTO.getSlideOrder(),
                chapterId);
    }

    public String updateAssessmentSlide(SlideDTO slideDTO, String chapterId, String packageSessionId, String moduleId,
            String subjectId) {
        AssessmentSlideDTO dto = slideDTO.getAssessmentSlide();
        if (dto == null || dto.getId() == null) {
            throw new VacademyException("assessment_slide.id is required for update");
        }

        AssessmentSlide assessmentSlide = assessmentSlideRepository.findById(dto.getId())
                .orElseThrow(() -> new VacademyException("Assessment slide not found"));

        if (dto.getAssessmentId() != null && !dto.getAssessmentId().isBlank()) {
            assessmentSlide.setAssessmentId(dto.getAssessmentId());
        }
        if (dto.getAllowReattempt() != null) {
            assessmentSlide.setAllowReattempt(dto.getAllowReattempt());
        }
        if (dto.getShowResult() != null) {
            assessmentSlide.setShowResult(dto.getShowResult());
        }
        assessmentSlideRepository.save(assessmentSlide);

        slideService.updateSlide(
                slideDTO.getId(),
                slideDTO.getStatus(),
                slideDTO.getTitle(),
                slideDTO.getDescription(),
                slideDTO.getImageFileId(),
                slideDTO.getSlideOrder(),
                chapterId,
                packageSessionId,
                moduleId,
                subjectId);

        return "success";
    }
}
