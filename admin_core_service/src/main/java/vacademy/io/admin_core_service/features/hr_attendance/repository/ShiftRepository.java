package vacademy.io.admin_core_service.features.hr_attendance.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_attendance.entity.Shift;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShiftRepository extends JpaRepository<Shift, String> {

    List<Shift> findByInstituteIdAndStatusOrderByNameAsc(String instituteId, String status);

    List<Shift> findByInstituteIdOrderByNameAsc(String instituteId);

    Optional<Shift> findByInstituteIdAndIsDefaultTrue(String instituteId);
}
