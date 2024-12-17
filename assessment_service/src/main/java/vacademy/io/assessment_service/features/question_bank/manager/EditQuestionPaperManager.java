package vacademy.io.assessment_service.features.question_bank.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.evaluation.service.QuestionEvaluationService;
import vacademy.io.assessment_service.features.question_bank.dto.UpdateQuestionPaperStatus;
import vacademy.io.assessment_service.features.question_bank.repository.QuestionPaperRepository;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;
import vacademy.io.assessment_service.features.rich_text.repository.AssessmentRichTextRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

@Component
public class EditQuestionPaperManager {

    @Autowired
    QuestionRepository questionRepository;

    @Autowired
    QuestionPaperRepository questionPaperRepository;

    @Autowired
    QuestionEvaluationService questionEvaluationService;

    @Autowired
    AssessmentRichTextRepository assessmentRichTextRepository;


    public Boolean markQuestionPaperAsFavourite(CustomUserDetails user, UpdateQuestionPaperStatus updateQuestionPaperStatus) {

        questionPaperRepository.updateStatusForInstituteQuestionPaper(updateQuestionPaperStatus.getInstituteId(), updateQuestionPaperStatus.getQuestionPaperId(), updateQuestionPaperStatus.getStatus());
        return true;
    }
}
