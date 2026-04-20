package vacademy.io.admin_core_service.features.fee_management.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAdjustmentHistory;

import java.util.List;

@Repository
public interface StudentFeeAdjustmentHistoryRepository
        extends JpaRepository<StudentFeeAdjustmentHistory, String> {

    Page<StudentFeeAdjustmentHistory> findByStudentFeePaymentIdOrderByCreatedAtDesc(
            String studentFeePaymentId, Pageable pageable);

    List<StudentFeeAdjustmentHistory> findByIdIn(List<String> ids);
}
