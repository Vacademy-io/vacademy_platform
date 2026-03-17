package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.slide.entity.ScormSlide;
import vacademy.io.admin_core_service.features.slide.entity.VideoSlide;

@Repository
public interface ScormSlideRepository extends JpaRepository<ScormSlide, String> {
}
