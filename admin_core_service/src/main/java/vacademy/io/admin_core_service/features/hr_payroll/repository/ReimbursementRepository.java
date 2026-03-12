package vacademy.io.admin_core_service.features.hr_payroll.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_payroll.entity.Reimbursement;

import java.util.List;

@Repository
public interface ReimbursementRepository extends JpaRepository<Reimbursement, String> {

    @Query("SELECT r FROM Reimbursement r WHERE r.instituteId = :instituteId " +
            "AND (:status IS NULL OR r.status = :status) " +
            "AND (:employeeId IS NULL OR r.employee.id = :employeeId) " +
            "ORDER BY r.createdAt DESC")
    Page<Reimbursement> findByFilters(@Param("instituteId") String instituteId,
                                       @Param("status") String status,
                                       @Param("employeeId") String employeeId,
                                       Pageable pageable);

    @Query("SELECT r FROM Reimbursement r WHERE r.employee.id = :employeeId AND r.status = 'APPROVED' AND r.payrollEntry IS NULL")
    List<Reimbursement> findApprovedUnpaid(@Param("employeeId") String employeeId);

    List<Reimbursement> findByPayrollEntryId(String payrollEntryId);
}
