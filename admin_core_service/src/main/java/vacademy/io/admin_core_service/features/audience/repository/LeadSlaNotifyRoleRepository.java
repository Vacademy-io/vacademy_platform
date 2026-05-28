package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.entity.LeadSlaNotifyRole;

import java.util.List;

@Repository
public interface LeadSlaNotifyRoleRepository extends JpaRepository<LeadSlaNotifyRole, String> {

    List<LeadSlaNotifyRole> findByInstituteId(String instituteId);

    List<LeadSlaNotifyRole> findByInstituteIdAndSlaType(String instituteId, String slaType);

    @Transactional
    void deleteByInstituteId(String instituteId);
}
