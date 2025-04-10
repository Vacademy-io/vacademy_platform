package vacademy.io.community_service.feature.presentation.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.presentation.entity.Presentation;
import vacademy.io.community_service.feature.presentation.entity.PresentationSlide;

import java.util.List;

public interface PresentationSlideRepository extends JpaRepository<PresentationSlide, String> {

    List<PresentationSlide> findAllByPresentationIdAndStatusIn(Presentation presentation, List<String> status);
}
