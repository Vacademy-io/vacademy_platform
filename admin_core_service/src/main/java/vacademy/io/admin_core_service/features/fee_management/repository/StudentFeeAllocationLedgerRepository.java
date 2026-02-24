package vacademy.io.admin_core_service.features.fee_management.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAllocationLedger;

import java.util.List;

@Repository
public interface StudentFeeAllocationLedgerRepository extends JpaRepository<StudentFeeAllocationLedger, String> {

    List<StudentFeeAllocationLedger> findByStudentFeePaymentId(String studentFeePaymentId);

    List<StudentFeeAllocationLedger> findByPaymentLogId(String paymentLogId);
}
