package vacademy.io.admin_core_service.features.fee_management.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.fee_management.entity.InstituteFeeTypePriority;

import java.util.List;

@Repository
public interface InstituteFeeTypePriorityRepository extends JpaRepository<InstituteFeeTypePriority, String> {

    List<InstituteFeeTypePriority> findByInstituteIdAndScopeOrderByPriorityOrderAsc(String instituteId, String scope);

    void deleteByInstituteIdAndScope(String instituteId, String scope);
}
