package vacademy.io.admin_core_service.features.hr_employee.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeDocument;

import java.util.List;

@Repository
public interface EmployeeDocumentRepository extends JpaRepository<EmployeeDocument, String> {

    List<EmployeeDocument> findByEmployeeIdOrderByCreatedAtDesc(String employeeId);

    List<EmployeeDocument> findByEmployeeIdAndDocumentType(String employeeId, String documentType);
}
