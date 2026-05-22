package vacademy.io.admin_core_service.features.counselor_pool.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPool;

import java.util.List;
import java.util.Optional;

@Repository
public interface CounselorPoolRepository extends JpaRepository<CounselorPool, String> {

    List<CounselorPool> findByInstituteIdOrderByCreatedAtDesc(String instituteId);

    Optional<CounselorPool> findByIdAndInstituteId(String id, String instituteId);

    boolean existsByInstituteIdAndNameIgnoreCase(String instituteId, String name);
}
