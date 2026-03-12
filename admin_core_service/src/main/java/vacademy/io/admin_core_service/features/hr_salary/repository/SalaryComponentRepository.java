package vacademy.io.admin_core_service.features.hr_salary.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_salary.entity.SalaryComponent;

import java.util.List;
import java.util.Optional;

@Repository
public interface SalaryComponentRepository extends JpaRepository<SalaryComponent, String> {

    List<SalaryComponent> findByInstituteIdAndIsActiveTrueOrderByDisplayOrderAsc(String instituteId);

    List<SalaryComponent> findByInstituteIdOrderByDisplayOrderAsc(String instituteId);

    List<SalaryComponent> findByInstituteIdAndType(String instituteId, String type);

    Optional<SalaryComponent> findByInstituteIdAndCode(String instituteId, String code);

    boolean existsByInstituteIdAndCode(String instituteId, String code);
}
