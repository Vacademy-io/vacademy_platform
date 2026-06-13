package vacademy.io.community_service.feature.status.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.status.entity.StatusIncident;

import java.util.List;

@Repository
public interface StatusIncidentRepository extends JpaRepository<StatusIncident, String> {

    List<StatusIncident> findAllByOrderByStartedAtDesc();
}
