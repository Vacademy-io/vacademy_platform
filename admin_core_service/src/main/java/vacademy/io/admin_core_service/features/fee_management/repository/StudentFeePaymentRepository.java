package vacademy.io.admin_core_service.features.fee_management.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;

import java.util.List;

@Repository
public interface StudentFeePaymentRepository extends JpaRepository<StudentFeePayment, String>,
        JpaSpecificationExecutor<StudentFeePayment> {

    // Fetch all bills for a plan
    List<StudentFeePayment> findByUserPlanId(String userPlanId);

    // Fetch all bills for a user (across plans)
    List<StudentFeePayment> findByUserId(String userId);

    // Fetch all bills for a list of plans
    List<StudentFeePayment> findByUserPlanIdIn(List<String> userPlanIds);

    // Used for FIFO Ledger Allocation: Grab only unpaid/partial bills, ordered by
    // oldest due date
    List<StudentFeePayment> findByUserPlanIdAndStatusNotOrderByDueDateAsc(String userPlanId, String status);

    // Manual/offline allocation: Grab unpaid/partial bills for a user, ordered by
    // oldest due date
    List<StudentFeePayment> findByUserIdAndStatusNotOrderByDueDateAsc(String userId, String status);

    // Unordered fetch for engine-based allocation (sorting done in Java)
    List<StudentFeePayment> findByUserIdAndStatusNot(String userId, String status);
}
