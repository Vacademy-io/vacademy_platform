package vacademy.io.community_service.feature.presentation.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.presentation.entity.Presentation;
import vacademy.io.community_service.feature.presentation.entity.question.Option;

public interface PresentationRepository extends JpaRepository<Presentation, String> {
}
