package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.slide.entity.VideoSlideQuestionOption;

public interface VideoSlideQuestionOptionRepository extends JpaRepository<VideoSlideQuestionOption,String> {
}
