package vacademy.io.admin_core_service.features.group.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.group.entity.PackageGroupMapping;

import java.util.List;

public interface PackageGroupMappingRepository extends JpaRepository<PackageGroupMapping, String> {
    @Query("""
    SELECT pgm
    FROM PackageGroupMapping pgm
    JOIN pgm.packageEntity pe
    JOIN PackageInstitute pi ON pi.packageEntity = pe
    WHERE pi.instituteEntity.id = :instituteId
""")
    List<PackageGroupMapping> findAllByInstituteId(@Param("instituteId") String instituteId);
}
