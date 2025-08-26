package vacademy.io.admin_core_service.features.slide.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import vacademy.io.admin_core_service.features.common.service.RichTextDataService;
import vacademy.io.admin_core_service.features.slide.dto.QuizSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.QuizSlideQuestionDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.entity.QuizSlide;
import vacademy.io.admin_core_service.features.slide.entity.QuizSlideQuestion;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.QuizSlideRepository;
import vacademy.io.common.ai.dto.RichTextDataDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors; // <-- Import Collectors

@Service
public class QuizSlideService {

    @Autowired
    private SlideService slideService;

    @Autowired
    private QuizSlideRepository quizSlideRepository;

    @Autowired
    private RichTextDataService richTextDataService;

    @Transactional
    public String addOrUpdateQuizSlide(SlideDTO slideDTO, String chapterId, String packageSessionId, String moduleId,
                                       String subjectId, CustomUserDetails userDetails) {
        if (slideDTO.isNewSlide()) {
            return addQuizSlide(slideDTO, chapterId);
        }
        return updateQuizSlide(slideDTO, chapterId, packageSessionId, moduleId, subjectId);
    }

    public String addOrUpdateQuizSlideRequest(SlideDTO slideDTO, String chapterId, CustomUserDetails userDetails) {
        return addQuizSlide(slideDTO, chapterId);
    }

    public String addQuizSlide(SlideDTO slideDTO, String chapterId) {
        QuizSlide quizSlide = new QuizSlide(slideDTO.getQuizSlide());

        QuizSlide savedQuizSlide = quizSlideRepository.save(quizSlide);

        String slideId = slideService.saveSlide(
                slideDTO.getId(),
                savedQuizSlide.getId(),
                SlideTypeEnum.QUIZ.name(),
                slideDTO.getStatus(),
                slideDTO.getTitle(),
                slideDTO.getDescription(),
                slideDTO.getImageFileId(),
                slideDTO.getSlideOrder(),
                chapterId);

        return slideId;
    }

    public String updateQuizSlide(SlideDTO slideDTO, String chapterId, String packageSessionId, String moduleId,
                                  String subjectId) {
        QuizSlideDTO quizSlideDTO = slideDTO.getQuizSlide();

        QuizSlide quizSlide = quizSlideRepository.findById(quizSlideDTO.getId())
                .orElseThrow(() -> new VacademyException("Quiz slide not found"));

        updateData(quizSlideDTO, quizSlide);

        try{
            quizSlideRepository.save(quizSlide);
        }
        catch(Exception e){
            e.printStackTrace();
        }

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

    public void updateData(QuizSlideDTO dto, QuizSlide quizSlide) {
        // <-- FIX: Use collect(Collectors.toList()) to create a mutable list
        quizSlide.setQuestions(dto.getQuestions().stream().map(q -> new QuizSlideQuestion(q, quizSlide)).collect(Collectors.toList()));
        quizSlide.setDescriptionRichText(new RichTextData(dto.getDescription()));
        addOrUpdateQuestionsInBulk(quizSlide, dto.getQuestions());
    }

    private void addOrUpdateQuestionsInBulk(QuizSlide quizSlide, List<QuizSlideQuestionDTO> quizSlideQuestionDTOs) {
        // Implementation for bulk question updates
        if (quizSlideQuestionDTOs != null && !quizSlideQuestionDTOs.isEmpty()) {
            // <-- FIX: Use collect(Collectors.toList()) to create a mutable list
            List<QuizSlideQuestion> questions = quizSlideQuestionDTOs.stream()
                    .map(q -> new QuizSlideQuestion(q, quizSlide))
                    .collect(Collectors.toList());
            quizSlide.setQuestions(questions);
        }
    }

    /**
     * Copy quiz slide and return new quiz slide ID
     */
    public String copyQuizSlide(String sourceQuizSlideId) {
        QuizSlide originalQuizSlide = quizSlideRepository.findById(sourceQuizSlideId)
                .orElseThrow(() -> new VacademyException("Quiz slide not found"));

        QuizSlide newQuizSlide = new QuizSlide();
        newQuizSlide.setId(UUID.randomUUID().toString());
        newQuizSlide.setTitle(originalQuizSlide.getTitle());

        // Copy description RichTextData if it exists
        if (originalQuizSlide.getDescriptionRichText() != null) {
            RichTextData newDescriptionRichText = new RichTextData();
            newDescriptionRichText.setId(UUID.randomUUID().toString());
            newDescriptionRichText.setType(originalQuizSlide.getDescriptionRichText().getType());
            newDescriptionRichText.setContent(originalQuizSlide.getDescriptionRichText().getContent());
            newQuizSlide.setDescriptionRichText(newDescriptionRichText);
        }

        // Copy questions if they exist
        if (originalQuizSlide.getQuestions() != null && !originalQuizSlide.getQuestions().isEmpty()) {
            // <-- FIX: Use collect(Collectors.toList()) to create a mutable list
            List<QuizSlideQuestion> newQuestions = originalQuizSlide.getQuestions().stream()
                    .map(this::copyQuizSlideQuestion)
                    .collect(Collectors.toList());
            newQuizSlide.setQuestions(newQuestions);
        }

        QuizSlide savedQuizSlide = quizSlideRepository.save(newQuizSlide);
        return savedQuizSlide.getId();
    }

    /**
     * Copy individual quiz slide question
     */
    private QuizSlideQuestion copyQuizSlideQuestion(QuizSlideQuestion originalQuestion) {
        QuizSlideQuestion newQuestion = new QuizSlideQuestion();
        newQuestion.setId(UUID.randomUUID().toString());
        newQuestion.setMediaId(originalQuestion.getMediaId());
        newQuestion.setStatus(originalQuestion.getStatus());
        newQuestion.setQuestionResponseType(originalQuestion.getQuestionResponseType());
        newQuestion.setQuestionType(originalQuestion.getQuestionType());
        newQuestion.setAccessLevel(originalQuestion.getAccessLevel());
        newQuestion.setAutoEvaluationJson(originalQuestion.getAutoEvaluationJson());
        newQuestion.setEvaluationType(originalQuestion.getEvaluationType());
        newQuestion.setQuestionOrder(originalQuestion.getQuestionOrder());
        newQuestion.setCanSkip(originalQuestion.getCanSkip());
        newQuestion.setCreatedAt(LocalDateTime.now());
        newQuestion.setUpdatedAt(LocalDateTime.now());

        // Copy RichTextData if they exist
        if (originalQuestion.getParentRichText() != null) {
            RichTextData newParentRichText = new RichTextData();
            newParentRichText.setId(UUID.randomUUID().toString());
            newParentRichText.setType(originalQuestion.getParentRichText().getType());
            newParentRichText.setContent(originalQuestion.getParentRichText().getContent());
            newQuestion.setParentRichText(newParentRichText);
        }

        if (originalQuestion.getText() != null) {
            RichTextData newText = new RichTextData();
            newText.setId(UUID.randomUUID().toString());
            newText.setType(originalQuestion.getText().getType());
            newText.setContent(originalQuestion.getText().getContent());
            newQuestion.setText(newText);
        }

        if (originalQuestion.getExplanationText() != null) {
            RichTextData newExplanationText = new RichTextData();
            newExplanationText.setId(UUID.randomUUID().toString());
            newExplanationText.setType(originalQuestion.getExplanationText().getType());
            newExplanationText.setContent(originalQuestion.getExplanationText().getContent());
            newQuestion.setExplanationText(newExplanationText);
        }

        return newQuestion;
    }
}