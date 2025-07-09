package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.slide.entity.QuizSlide;

@Repository
public interface QuizSlideRepository extends JpaRepository<QuizSlide, String> {
    // You can add custom query methods here if needed
}
