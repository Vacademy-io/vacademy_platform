package vacademy.io.admin_core_service.features.hr_employee.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_employee.entity.Department;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, String> {

    List<Department> findByInstituteIdAndStatusOrderByNameAsc(String instituteId, String status);

    List<Department> findByInstituteIdOrderByNameAsc(String instituteId);

    List<Department> findByParentId(String parentId);

    Optional<Department> findByInstituteIdAndCode(String instituteId, String code);

    boolean existsByInstituteIdAndCode(String instituteId, String code);

    @Query("SELECT d FROM Department d WHERE d.instituteId = :instituteId AND d.parent IS NULL AND d.status = 'ACTIVE' ORDER BY d.name")
    List<Department> findRootDepartments(@Param("instituteId") String instituteId);
}
