package vacademy.io.admin_core_service.features.hr_approval.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_approval.entity.ApprovalChain;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApprovalChainRepository extends JpaRepository<ApprovalChain, String> {

    Optional<ApprovalChain> findByInstituteIdAndEntityType(String instituteId, String entityType);

    List<ApprovalChain> findByInstituteIdOrderByEntityTypeAsc(String instituteId);
}
