package vacademy.io.admin_core_service.features.hr_payslip.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_payslip.entity.BankExportLog;

import java.util.List;

@Repository
public interface BankExportLogRepository extends JpaRepository<BankExportLog, String> {

    List<BankExportLog> findByPayrollRunIdOrderByCreatedAtDesc(String payrollRunId);
}
