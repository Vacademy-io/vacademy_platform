package vacademy.io.community_service.feature.filter.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.filter.entity.QuestionPaper;

public interface QuestionPaperRepository extends JpaRepository<QuestionPaper, String> {
}

