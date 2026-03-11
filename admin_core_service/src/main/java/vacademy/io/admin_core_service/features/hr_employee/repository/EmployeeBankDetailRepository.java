package vacademy.io.admin_core_service.features.hr_employee.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeBankDetail;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeeBankDetailRepository extends JpaRepository<EmployeeBankDetail, String> {

    List<EmployeeBankDetail> findByEmployeeIdAndStatus(String employeeId, String status);

    List<EmployeeBankDetail> findByEmployeeId(String employeeId);

    Optional<EmployeeBankDetail> findByEmployeeIdAndIsPrimaryTrue(String employeeId);
}
