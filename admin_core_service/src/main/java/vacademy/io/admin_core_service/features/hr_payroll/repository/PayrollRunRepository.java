package vacademy.io.admin_core_service.features.hr_payroll.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollRun;

import java.util.List;
import java.util.Optional;

@Repository
public interface PayrollRunRepository extends JpaRepository<PayrollRun, String> {

    Optional<PayrollRun> findByInstituteIdAndMonthAndYear(String instituteId, Integer month, Integer year);

    List<PayrollRun> findByInstituteIdAndYearOrderByMonthDesc(String instituteId, Integer year);

    List<PayrollRun> findByInstituteIdOrderByYearDescMonthDesc(String instituteId);
}
