package vacademy.io.admin_core_service.features.hr_salary.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_salary.entity.SalaryTemplate;

import java.util.List;
import java.util.Optional;

@Repository
public interface SalaryTemplateRepository extends JpaRepository<SalaryTemplate, String> {

    List<SalaryTemplate> findByInstituteIdAndStatusOrderByNameAsc(String instituteId, String status);

    List<SalaryTemplate> findByInstituteIdOrderByNameAsc(String instituteId);

    Optional<SalaryTemplate> findByInstituteIdAndIsDefaultTrue(String instituteId);
}
