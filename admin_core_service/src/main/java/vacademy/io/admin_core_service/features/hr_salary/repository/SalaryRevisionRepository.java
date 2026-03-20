package vacademy.io.admin_core_service.features.hr_salary.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_salary.entity.SalaryRevision;

import java.util.List;

@Repository
public interface SalaryRevisionRepository extends JpaRepository<SalaryRevision, String> {

    List<SalaryRevision> findByEmployeeIdOrderByEffectiveDateDesc(String employeeId);
}
