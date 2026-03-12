package vacademy.io.admin_core_service.features.hr_leave.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_leave.entity.LeaveType;

import java.util.List;
import java.util.Optional;

@Repository
public interface LeaveTypeRepository extends JpaRepository<LeaveType, String> {

    List<LeaveType> findByInstituteIdAndStatusOrderByNameAsc(String instituteId, String status);

    List<LeaveType> findByInstituteIdOrderByNameAsc(String instituteId);

    Optional<LeaveType> findByInstituteIdAndCode(String instituteId, String code);

    boolean existsByInstituteIdAndCode(String instituteId, String code);
}
