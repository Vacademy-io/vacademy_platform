package vacademy.io.admin_core_service.features.hr_employee.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_employee.entity.Designation;

import java.util.List;
import java.util.Optional;

@Repository
public interface DesignationRepository extends JpaRepository<Designation, String> {

    List<Designation> findByInstituteIdAndStatusOrderByLevelAscNameAsc(String instituteId, String status);

    List<Designation> findByInstituteIdOrderByLevelAscNameAsc(String instituteId);

    Optional<Designation> findByInstituteIdAndCode(String instituteId, String code);

    boolean existsByInstituteIdAndCode(String instituteId, String code);
}
