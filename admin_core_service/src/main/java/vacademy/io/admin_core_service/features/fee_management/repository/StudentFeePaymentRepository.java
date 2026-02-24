package vacademy.io.admin_core_service.features.fee_management.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;

import java.util.List;

@Repository
public interface StudentFeePaymentRepository extends JpaRepository<StudentFeePayment, String> {

    // Fetch all bills for a plan
    List<StudentFeePayment> findByUserPlanId(String userPlanId);

    // Used for FIFO Ledger Allocation: Grab only unpaid/partial bills, ordered by
    // oldest due date
    List<StudentFeePayment> findByUserPlanIdAndStatusNotOrderByDueDateAsc(String userPlanId, String status);
}
