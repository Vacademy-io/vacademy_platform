package vacademy.io.assessment_service.features.question_core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.util.List;

public interface QuestionRepository extends JpaRepository<Question, String> {

    @Query(value = "SELECT q.* FROM question q " +
            "JOIN question_question_paper_mapping qp ON q.id = qp.question_id " +
            "WHERE qp.question_paper_id = :questionPaperId and q.status != 'DELETED'", nativeQuery = true)
    List<Question> findQuestionsByQuestionPaperId(@Param("questionPaperId") String questionPaperId);
}
