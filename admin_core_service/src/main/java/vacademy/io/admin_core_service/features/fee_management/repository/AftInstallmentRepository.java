package vacademy.io.admin_core_service.features.fee_management.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.fee_management.entity.AftInstallment;

import java.util.List;

@Repository
public interface AftInstallmentRepository extends JpaRepository<AftInstallment, String> {

    List<AftInstallment> findByAssignedFeeValueIdOrderByInstallmentNumberAsc(String assignedFeeValueId);
}
