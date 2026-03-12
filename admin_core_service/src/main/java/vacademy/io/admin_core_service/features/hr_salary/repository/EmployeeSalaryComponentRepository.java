package vacademy.io.admin_core_service.features.hr_salary.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_salary.entity.EmployeeSalaryComponent;

import java.util.List;

@Repository
public interface EmployeeSalaryComponentRepository extends JpaRepository<EmployeeSalaryComponent, String> {

    List<EmployeeSalaryComponent> findBySalaryStructureId(String salaryStructureId);

    void deleteBySalaryStructureId(String salaryStructureId);
}
