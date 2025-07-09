package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.slide.entity.QuizSlideQuestion;

import java.util.List;

@Repository
public interface QuizSlideQuestionRepository extends JpaRepository<QuizSlideQuestion, String> {

    List<QuizSlideQuestion> findByQuizSlideId(String quizSlideId);
}
