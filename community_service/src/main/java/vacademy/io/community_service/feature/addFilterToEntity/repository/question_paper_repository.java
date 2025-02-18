package vacademy.io.community_service.feature.addFilterToEntity.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.addFilterToEntity.entity.question_paper;

public interface question_paper_repository extends JpaRepository<question_paper, String> {
}

