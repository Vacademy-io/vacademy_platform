package vacademy.io.admin_core_service.features.slide.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.service.RichTextDataService;
import vacademy.io.admin_core_service.features.slide.dto.AssignmentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.entity.AssignmentSlide;
import vacademy.io.admin_core_service.features.slide.entity.AssignmentSlideQuestion;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.AssignmentSlideRepository;
import vacademy.io.common.ai.dto.RichTextDataDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Date;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AssignmentSlideService {

    @Autowired
    private SlideService slideService;

    @Autowired
    private AssignmentSlideRepository assignmentSlideRepository;

    @Autowired
    private RichTextDataService richTextDataService;

    public String addOrUpdateAssignmentSlide(SlideDTO slideDTO, String chapterId, String packageSessionId,
            String moduleId, String subjectId, CustomUserDetails userDetails) {
        if (slideDTO.isNewSlide()) {
            return addAssignmentSlide(slideDTO, chapterId);
        }
        return updateAssignmentSlide(slideDTO, chapterId, packageSessionId, moduleId, subjectId);
    }

    public String addOrUpdateAssignmentSlideRequest(SlideDTO slideDTO, String chapterId,
            CustomUserDetails userDetails) {
        return addAssignmentSlide(slideDTO, chapterId);
    }

    public String addAssignmentSlide(SlideDTO slideDTO, String chapterId) {
        AssignmentSlide assignmentSlide = new AssignmentSlide(slideDTO.getAssignmentSlide());
        AssignmentSlide savedAssignmentSlide = assignmentSlideRepository.save(assignmentSlide);
        return slideService.saveSlide(
                slideDTO.getId(),
                savedAssignmentSlide.getId(),
                SlideTypeEnum.ASSIGNMENT.name(),
                slideDTO.getStatus(),
                slideDTO.getTitle(),
                slideDTO.getDescription(),
                slideDTO.getImageFileId(),
                slideDTO.getSlideOrder(),
                chapterId);
    }

    public String updateAssignmentSlide(SlideDTO slideDTO, String chapterId, String packageSessionId, String moduleId,
            String subjectId) {
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
                subjectId);

        return "success";
    }

    public void updateData(AssignmentSlideDTO dto, AssignmentSlide assignmentSlide) {
        if (dto.getId() != null) {
            assignmentSlide.setId(dto.getId());
        }

        List<RichTextDataDTO> richTextDTOs = new ArrayList<>();
        if (dto.getParentRichText() != null)
            richTextDTOs.add(dto.getParentRichText());
        if (dto.getTextData() != null)
            richTextDTOs.add(dto.getTextData());

        if (!richTextDTOs.isEmpty()) {
            richTextDataService.updateRichTextDataInBulk(richTextDTOs);
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

        List<AssignmentSlideQuestion> existingQuestions = assignmentSlide.getAssignmentSlideQuestions();
        existingQuestions.clear();

        if (dto.getQuestions() != null && !dto.getQuestions().isEmpty()) {
            for (var questionDTO : dto.getQuestions()) {
                existingQuestions.add(new AssignmentSlideQuestion(questionDTO, assignmentSlide));
            }
        }

        assignmentSlideRepository.save(assignmentSlide);
    }

    /**
     * Copy assignment slide and return new assignment slide ID
     */
//    public String copyAssignmentSlide(String sourceAssignmentSlideId) {
//        AssignmentSlide originalAssignmentSlide = assignmentSlideRepository.findById(sourceAssignmentSlideId)
//                .orElseThrow(() -> new VacademyException("Assignment slide not found"));
//
//        AssignmentSlide newAssignmentSlide = new AssignmentSlide();
//        newAssignmentSlide.setId(UUID.randomUUID().toString());
//        newAssignmentSlide.setLiveDate(originalAssignmentSlide.getLiveDate());
//        newAssignmentSlide.setEndDate(originalAssignmentSlide.getEndDate());
//        newAssignmentSlide.setReAttemptCount(originalAssignmentSlide.getReAttemptCount());
//        newAssignmentSlide.setCommaSeparatedMediaIds(originalAssignmentSlide.getCommaSeparatedMediaIds());
//
//        // Copy RichTextData if they exist
//        if (originalAssignmentSlide.getParentRichText() != null) {
//            RichTextData newParentRichText = new RichTextData();
//            newParentRichText.setId(UUID.randomUUID().toString());
//            newParentRichText.setType(originalAssignmentSlide.getParentRichText().getType());
//            newParentRichText.setContent(originalAssignmentSlide.getParentRichText().getContent());
//            newAssignmentSlide.setParentRichText(newParentRichText);
//        }
//
//        if (originalAssignmentSlide.getTextData() != null) {
//            RichTextData newTextData = new RichTextData();
//            newTextData.setId(UUID.randomUUID().toString());
//            newTextData.setType(originalAssignmentSlide.getTextData().getType());
//            newTextData.setContent(originalAssignmentSlide.getTextData().getContent());
//            newAssignmentSlide.setTextData(newTextData);
//        }
//
//        // Copy questions if they exist
//        if (originalAssignmentSlide.getAssignmentSlideQuestions() != null
//                && !originalAssignmentSlide.getAssignmentSlideQuestions().isEmpty()) {
//            List<AssignmentSlideQuestion> newQuestions = originalAssignmentSlide.getAssignmentSlideQuestions().stream()
//                    .map(this::copyAssignmentSlideQuestion)
//                    .toList();
//            newAssignmentSlide.setAssignmentSlideQuestions(newQuestions);
//        }
//
//        AssignmentSlide savedAssignmentSlide = assignmentSlideRepository.save(newAssignmentSlide);
//        return savedAssignmentSlide.getId();
//    }
//
//    /**
//     * Copy individual assignment slide question
//     */
//    private AssignmentSlideQuestion copyAssignmentSlideQuestion(AssignmentSlideQuestion originalQuestion) {
//        AssignmentSlideQuestion newQuestion = new AssignmentSlideQuestion();
//        newQuestion.setId(UUID.randomUUID().toString());
//        newQuestion.setQuestionOrder(originalQuestion.getQuestionOrder());
//        newQuestion.setStatus(originalQuestion.getStatus());
//
//        // Copy RichTextData if it exists
//        if (originalQuestion.getTextData() != null) {
//            RichTextData newTextData = new RichTextData();
//            newTextData.setId(UUID.randomUUID().toString());
//            newTextData.setType(originalQuestion.getTextData().getType());
//            newTextData.setContent(originalQuestion.getTextData().getContent());
//            newQuestion.setTextData(newTextData);
//        }
//
//        return newQuestion;
//    }
}
