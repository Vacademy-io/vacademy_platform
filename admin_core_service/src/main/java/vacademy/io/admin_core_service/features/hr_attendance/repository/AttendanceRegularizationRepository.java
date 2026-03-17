package vacademy.io.admin_core_service.features.hr_attendance.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_attendance.entity.AttendanceRegularization;

import java.util.List;

@Repository
public interface AttendanceRegularizationRepository extends JpaRepository<AttendanceRegularization, String> {

    List<AttendanceRegularization> findByEmployeeIdOrderByCreatedAtDesc(String employeeId);

    List<AttendanceRegularization> findByApprovalStatusOrderByCreatedAtDesc(String approvalStatus);
}
