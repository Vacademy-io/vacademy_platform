package vacademy.io.admin_core_service.features.hr_salary.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_salary.entity.EmployeeSalaryStructure;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeeSalaryStructureRepository extends JpaRepository<EmployeeSalaryStructure, String> {

    List<EmployeeSalaryStructure> findByEmployeeIdOrderByEffectiveFromDesc(String employeeId);

    Optional<EmployeeSalaryStructure> findFirstByEmployee_IdAndStatusOrderByEffectiveFromDesc(String employeeId, String status);

    @Query("SELECT s FROM EmployeeSalaryStructure s WHERE s.employee.id = :employeeId AND s.status = 'ACTIVE'")
    List<EmployeeSalaryStructure> findAllActiveByEmployee(@Param("employeeId") String employeeId);
}
