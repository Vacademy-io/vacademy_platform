package vacademy.io.community_service.feature.roadmap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.roadmap.entity.ProductRoadmap;

public interface ProductRoadmapRepository extends JpaRepository<ProductRoadmap, String> {
}
