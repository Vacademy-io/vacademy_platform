package vacademy.io.assessment_service.features.question_bank.repository;


import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.util.List;
import java.util.UUID;

public class QuestionPaperCustomRepositoryImpl implements QuestionPaperCustomRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public void bulkInsertQuestionsToQuestionPaper(String questionPaperId, List<String> questionIds) {
        StringBuilder sql = new StringBuilder("INSERT INTO public.question_question_paper_mapping (id, question_id, question_paper_id) VALUES ");

        for (int i = 0; i < questionIds.size(); i++) {
            String mappingId = UUID.randomUUID().toString(); // Generate unique ID for each mapping
            sql.append("('").append(mappingId).append("', '").append(questionIds.get(i)).append("', '").append(questionPaperId).append("')");
            if (i < questionIds.size() - 1) {
                sql.append(", ");
            }
        }

        // Execute the constructed SQL statement
        entityManager.createNativeQuery(sql.toString()).executeUpdate();
    }
}
