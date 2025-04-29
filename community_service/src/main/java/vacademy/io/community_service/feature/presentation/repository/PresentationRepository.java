package vacademy.io.community_service.feature.presentation.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.community_service.feature.presentation.entity.Presentation;

import java.util.List;

public interface PresentationRepository extends JpaRepository<Presentation, String> {

    List<Presentation> findAllByInstituteIdAndStatusIn(String instituteId, List<String> status);
}
