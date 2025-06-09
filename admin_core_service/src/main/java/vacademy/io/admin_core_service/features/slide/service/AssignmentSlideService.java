package vacademy.io.admin_core_service.features.slide.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.service.RichTextDataService;
import vacademy.io.admin_core_service.features.slide.dto.AssignmentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.entity.AssignmentSlide;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.AssignmentSlideRepository;
import vacademy.io.common.ai.dto.RichTextDataDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;

@Service
public class AssignmentSlideService {

    @Autowired
    private SlideService slideService;

    @Autowired
    private AssignmentSlideRepository assignmentSlideRepository;

    @Autowired
    private RichTextDataService richTextDataService;

    public String addOrUpdateAssignmentSlide(SlideDTO slideDTO, String chapterId,String packageSessionId,String moduleId,String subjectId, CustomUserDetails userDetails) {
        if (slideDTO.isNewSlide()) {
            return addAssignmentSlide(slideDTO, chapterId);
        }
        return updateAssignmentSlide(slideDTO, chapterId,packageSessionId,moduleId,subjectId);
    }

    public String addAssignmentSlide(SlideDTO slideDTO, String chapterId) {
        AssignmentSlide assignmentSlide = new AssignmentSlide(slideDTO.getAssignmentSlide());
        AssignmentSlide savedAssignmentSlide = assignmentSlideRepository.save(assignmentSlide);
        slideService.saveSlide(
                slideDTO.getId(),
                savedAssignmentSlide.getId(),
                SlideTypeEnum.ASSIGNMENT.name(),
                slideDTO.getStatus(),
                slideDTO.getTitle(),
                slideDTO.getDescription(),
                slideDTO.getImageFileId(),
                slideDTO.getSlideOrder(),
                chapterId
        );
        return "success";
    }

    public String updateAssignmentSlide(SlideDTO slideDTO, String chapterId,String packageSessionId,String moduleId,String subjectId) {
        AssignmentSlideDTO assignmentSlideDTO = slideDTO.getAssignmentSlide();
        AssignmentSlide assignmentSlide = assignmentSlideRepository.findById(assignmentSlideDTO.getId())
                .orElseThrow(() -> new VacademyException("Assignment slide not found"));

        updateData(assignmentSlideDTO, assignmentSlide);

        assignmentSlideRepository.save(assignmentSlide);
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
                subjectId
        );

        return "success";
    }

    public void updateData(AssignmentSlideDTO dto, AssignmentSlide assignmentSlide) {
        if (dto.getId() != null) {
            assignmentSlide.setId(dto.getId());
        }

        List<RichTextDataDTO> richTextDTOs = new ArrayList<>();
        if (dto.getParentRichText() != null) richTextDTOs.add(dto.getParentRichText());
        if (dto.getTextData() != null) richTextDTOs.add(dto.getTextData());

        if (!richTextDTOs.isEmpty()) {
            richTextDataService.updateRichTextDataInBulk(richTextDTOs);  // 🔥
        }

        if (dto.getLiveDate() != null) {
            assignmentSlide.setLiveDate(dto.getLiveDate());
        }
        if (dto.getEndDate() != null) {
            assignmentSlide.setEndDate(dto.getEndDate());
        }
        if (dto.getReAttemptCount() != null) {
            assignmentSlide.setReAttemptCount(dto.getReAttemptCount());
        }
        if (StringUtils.hasText(dto.getCommaSeparatedMediaIds())) {
            assignmentSlide.setCommaSeparatedMediaIds(dto.getCommaSeparatedMediaIds());
        }
    }
}
