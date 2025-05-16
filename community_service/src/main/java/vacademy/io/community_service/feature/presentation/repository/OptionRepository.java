package vacademy.io.community_service.feature.presentation.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.presentation.entity.question.Option;

public interface OptionRepository extends JpaRepository<Option, String> {
}
