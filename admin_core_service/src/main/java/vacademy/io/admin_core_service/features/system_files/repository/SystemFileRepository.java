package vacademy.io.admin_core_service.features.system_files.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.system_files.entity.SystemFile;

import java.util.List;
import java.util.Optional;

@Repository
public interface SystemFileRepository extends JpaRepository<SystemFile, String> {

        List<SystemFile> findByInstituteIdAndStatus(String instituteId, String status);

        Optional<SystemFile> findByIdAndStatus(String id, String status);

        Optional<SystemFile> findByIdAndInstituteId(String id, String instituteId);
}
