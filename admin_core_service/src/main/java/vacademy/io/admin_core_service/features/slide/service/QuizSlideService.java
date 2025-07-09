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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class QuizSlideService {

    @Autowired
    private SlideService slideService;

    @Autowired
    private QuizSlideRepository quizSlideRepository;

    @Autowired
    private RichTextDataService richTextDataService;

    @Transactional
    public String addOrUpdateQuizSlide(SlideDTO slideDTO, String chapterId, String packageSessionId, String moduleId, String subjectId, CustomUserDetails userDetails) {
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

        Slide slide = slideService.saveSlide(
                slideDTO.getId(),
                savedQuizSlide.getId(),
                SlideTypeEnum.QUIZ.name(),
                slideDTO.getStatus(),
                slideDTO.getTitle(),
                slideDTO.getDescription(),
                slideDTO.getImageFileId(),
                slideDTO.getSlideOrder(),
                chapterId
        );

        return slide.getId();
    }

    public String updateQuizSlide(SlideDTO slideDTO, String chapterId, String packageSessionId, String moduleId, String subjectId) {
        QuizSlideDTO quizSlideDTO = slideDTO.getQuizSlide();

        QuizSlide quizSlide = quizSlideRepository.findById(quizSlideDTO.getId())
                .orElseThrow(() -> new VacademyException("Quiz slide not found"));

        updateData(quizSlideDTO, quizSlide);

        quizSlideRepository.save(quizSlide);

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

    public void updateData(QuizSlideDTO dto, QuizSlide quizSlide) {
        quizSlide.setQuestions(dto.getQuestions().stream().map(q -> new QuizSlideQuestion(q,quizSlide)).toList());
        List<RichTextDataDTO> richTextDataList = new ArrayList<>();
        if (dto.getDescription() != null) {
            if (quizSlide.getDescriptionRichText() != null) {
                richTextDataList.add(dto.getDescription());
            }else{
                quizSlide.setDescriptionRichText(new RichTextData(dto.getDescription()));
            }
        }
        addOrUpdateQuestionsInBulk(quizSlide, dto.getQuestions());
    }

    private void addOrUpdateQuestionsInBulk(QuizSlide quizSlide, List<QuizSlideQuestionDTO>quizSlideQuestionDTOs) {
       List<QuizSlideQuestion> questions = new ArrayList<>();
        for (QuizSlideQuestionDTO quizSlideQuestionDTO : quizSlideQuestionDTOs) {
            questions.add(new QuizSlideQuestion(quizSlideQuestionDTO,quizSlide));
        }
        quizSlide.setQuestions(questions);
    }
}
