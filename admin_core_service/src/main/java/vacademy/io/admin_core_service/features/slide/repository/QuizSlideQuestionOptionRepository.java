package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.slide.entity.QuizSlideQuestionOption;

import java.util.List;

@Repository
public interface QuizSlideQuestionOptionRepository extends JpaRepository<QuizSlideQuestionOption, String> {

    List<QuizSlideQuestionOption> findByQuizSlideQuestionId(String quizSlideQuestionId);
}
