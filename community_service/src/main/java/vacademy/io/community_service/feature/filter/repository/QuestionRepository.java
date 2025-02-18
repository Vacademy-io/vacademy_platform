package vacademy.io.community_service.feature.filter.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.filter.entity.Question;

@Repository
public interface QuestionRepository extends JpaRepository<Question, String> {
}

