package vacademy.io.admin_core_service.features.hr_payroll.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollEntryComponent;

import java.util.List;

@Repository
public interface PayrollEntryComponentRepository extends JpaRepository<PayrollEntryComponent, String> {

    List<PayrollEntryComponent> findByPayrollEntryId(String payrollEntryId);

    void deleteByPayrollEntryId(String payrollEntryId);
}
