package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.slide.entity.DocumentSlide;

public interface DocumentSlideRepository extends JpaRepository<DocumentSlide, String> {

}
