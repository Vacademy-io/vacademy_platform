package vacademy.io.assessment_service.features.question_bank.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.question_bank.dto.UpdateQuestionPaperStatus;
import vacademy.io.assessment_service.features.question_bank.repository.QuestionPaperRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

@Component
public class EditQuestionPaperManager {

    @Autowired
    QuestionPaperRepository questionPaperRepository;


    public Boolean markQuestionPaperAsFavourite(CustomUserDetails user, UpdateQuestionPaperStatus updateQuestionPaperStatus) {

        questionPaperRepository.updateStatusForInstituteQuestionPaper(updateQuestionPaperStatus.getInstituteId(), updateQuestionPaperStatus.getQuestionPaperId(), updateQuestionPaperStatus.getStatus());
        return true;
    }
}
