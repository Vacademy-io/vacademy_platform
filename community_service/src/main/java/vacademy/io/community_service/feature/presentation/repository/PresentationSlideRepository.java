package vacademy.io.community_service.feature.presentation.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.presentation.entity.Presentation;
import vacademy.io.community_service.feature.presentation.entity.PresentationSlide;

import java.util.List;

public interface PresentationSlideRepository extends JpaRepository<PresentationSlide, String> {

    List<PresentationSlide> findAllByPresentationAndStatusIn(Presentation presentation, List<String> status);

    /**
     * Finds all slides for a given presentation with a status other than the one specified,
     * ordered by their slide order.
     *
     * @param presentation The presentation entity.
     * @param status The status to exclude (e.g., "DELETED").
     * @return A sorted list of presentation slides.
     */
    List<PresentationSlide> findAllByPresentationAndStatusNotOrderBySlideOrderAsc(Presentation presentation, String status);
}
