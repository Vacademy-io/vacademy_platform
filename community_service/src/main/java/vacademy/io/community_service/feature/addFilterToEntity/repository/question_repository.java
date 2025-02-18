package vacademy.io.community_service.feature.addFilterToEntity.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.addFilterToEntity.entity.question;

@Repository
public interface question_repository extends JpaRepository<question, String> {
}

