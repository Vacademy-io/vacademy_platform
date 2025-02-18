package vacademy.io.community_service.feature.addFilterToEntity.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.addFilterToEntity.entity.QuestionPaper;

public interface QuestionPaperRepository extends JpaRepository<QuestionPaper, String> {
}

