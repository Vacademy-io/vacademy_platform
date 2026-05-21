package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.audience.entity.LeadStatus;

import java.util.List;
import java.util.Optional;

@Repository
public interface LeadStatusRepository extends JpaRepository<LeadStatus, String> {

    List<LeadStatus> findByInstituteIdAndIsActiveTrueOrderByDisplayOrderAsc(String instituteId);

    List<LeadStatus> findByInstituteIdOrderByDisplayOrderAsc(String instituteId);

    List<LeadStatus> findByInstituteIdInAndIsActiveTrue(List<String> instituteIds);

    Optional<LeadStatus> findByInstituteIdAndStatusKey(String instituteId, String statusKey);

    Optional<LeadStatus> findByInstituteIdAndIsDefaultTrueAndIsActiveTrue(String instituteId);

    long countByInstituteId(String instituteId);
}
