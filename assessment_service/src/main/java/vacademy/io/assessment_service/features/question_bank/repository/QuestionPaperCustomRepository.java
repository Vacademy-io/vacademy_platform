package vacademy.io.assessment_service.features.question_bank.repository;

import java.util.List;

public interface QuestionPaperCustomRepository {
    void bulkInsertQuestionsToQuestionPaper(String questionPaperId, List<String> questionIds);
}