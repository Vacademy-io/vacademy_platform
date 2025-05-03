package vacademy.io.assessment_service.features.question_bank.repository;


import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;

import java.util.List;
import java.util.UUID;

public class QuestionPaperCustomRepositoryImpl implements QuestionPaperCustomRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    public void bulkInsertQuestionsToQuestionPaper(String questionPaperId, List<String> questionIds) {
        StringBuilder sql = new StringBuilder("INSERT INTO public.question_question_paper_mapping (id, question_id, question_paper_id, question_order) VALUES ");

        for (int i = 0; i < questionIds.size(); i++) {
            String mappingId = UUID.randomUUID().toString();
            sql.append("('").append(mappingId).append("', '").append(questionIds.get(i)).append("', '").append(questionPaperId).append("', ").append(i + 1).append(")");
            if (i < questionIds.size() - 1) {
                sql.append(", ");
            }
        }

        entityManager.createNativeQuery(sql.toString()).executeUpdate();
    }
}
