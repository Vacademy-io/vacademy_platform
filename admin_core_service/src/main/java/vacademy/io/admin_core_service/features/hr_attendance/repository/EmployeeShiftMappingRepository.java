package vacademy.io.admin_core_service.features.hr_attendance.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_attendance.entity.EmployeeShiftMapping;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface EmployeeShiftMappingRepository extends JpaRepository<EmployeeShiftMapping, String> {

    @Query("SELECT m FROM EmployeeShiftMapping m WHERE m.employee.id = :employeeId " +
            "AND m.effectiveFrom <= :date AND (m.effectiveTo IS NULL OR m.effectiveTo >= :date)")
    Optional<EmployeeShiftMapping> findActiveMapping(@Param("employeeId") String employeeId, @Param("date") LocalDate date);
}
