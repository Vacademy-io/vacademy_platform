package vacademy.io.admin_core_service.features.fee_management.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.fee_management.entity.AssignedFeeValue;

import java.util.List;

@Repository
public interface AssignedFeeValueRepository extends JpaRepository<AssignedFeeValue, String> {

    List<AssignedFeeValue> findByFeeTypeId(String feeTypeId);

    List<AssignedFeeValue> findByFeeTypeIdAndStatusNot(String feeTypeId, String status);
}
