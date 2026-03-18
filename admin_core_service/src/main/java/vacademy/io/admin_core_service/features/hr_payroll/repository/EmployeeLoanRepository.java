package vacademy.io.admin_core_service.features.hr_payroll.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_payroll.entity.EmployeeLoan;

import java.util.List;

@Repository
public interface EmployeeLoanRepository extends JpaRepository<EmployeeLoan, String> {

    List<EmployeeLoan> findByEmployeeIdOrderByCreatedAtDesc(String employeeId);

    List<EmployeeLoan> findByInstituteIdAndStatusOrderByCreatedAtDesc(String instituteId, String status);

    @Query("SELECT l FROM EmployeeLoan l WHERE l.employee.id = :employeeId AND l.status = 'ACTIVE'")
    List<EmployeeLoan> findActiveLoans(@Param("employeeId") String employeeId);
}
