package vacademy.io.assessment_service.features.question_core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.util.List;

public interface QuestionRepository extends JpaRepository<Question, String> {

    @Query("SELECT q FROM Question q JOIN QuestionQuestionPaperMapping qp ON q.id = qp.questionId WHERE qp.questionPaperId = :questionPaperId")
    List<Question> findQuestionsByQuestionPaperId(@Param("questionPaperId") String questionPaperId);
}
