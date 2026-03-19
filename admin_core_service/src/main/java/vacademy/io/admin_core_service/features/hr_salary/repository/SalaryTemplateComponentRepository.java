package vacademy.io.admin_core_service.features.hr_salary.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_salary.entity.SalaryTemplateComponent;

import java.util.List;

@Repository
public interface SalaryTemplateComponentRepository extends JpaRepository<SalaryTemplateComponent, String> {

    List<SalaryTemplateComponent> findByTemplateIdOrderByDisplayOrderAsc(String templateId);

    void deleteByTemplateId(String templateId);
}
