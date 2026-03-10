package vacademy.io.admin_core_service.features.hr_payroll.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollEntry;

import java.util.List;
import java.util.Optional;

@Repository
public interface PayrollEntryRepository extends JpaRepository<PayrollEntry, String> {

    List<PayrollEntry> findByPayrollRunIdOrderByEmployeeEmployeeCodeAsc(String payrollRunId);

    Optional<PayrollEntry> findByPayrollRunIdAndEmployeeId(String payrollRunId, String employeeId);

    @Query("SELECT pe FROM PayrollEntry pe WHERE pe.employee.id = :employeeId ORDER BY pe.payrollRun.year DESC, pe.payrollRun.month DESC")
    List<PayrollEntry> findByEmployeeIdOrderByPeriodDesc(@Param("employeeId") String employeeId);
}
