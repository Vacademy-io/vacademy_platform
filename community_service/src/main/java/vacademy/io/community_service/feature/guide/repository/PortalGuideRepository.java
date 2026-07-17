package vacademy.io.community_service.feature.guide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.guide.entity.PortalGuide;

import java.util.List;

public interface PortalGuideRepository extends JpaRepository<PortalGuide, String> {
    List<PortalGuide> findByActiveTrueOrderByCreatedAtDesc();

    List<PortalGuide> findAllByOrderByCreatedAtDesc();
}
