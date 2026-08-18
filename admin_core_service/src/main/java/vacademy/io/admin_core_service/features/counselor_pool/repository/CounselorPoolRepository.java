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

    /**
     * Does this institute have ANY counsellor pool configured (Leads &rarr;
     * Settings &rarr; Pools)? Used by {@code AudienceRoleAccessService} to gate
     * the per-role "only my assigned leads" audience-access option: a pool owns
     * lead ownership, so that option stays inert while one exists. Mirrors what
     * the admin sees on the Pools page — an empty list means "no pool", mode
     * (MANUAL / ROUND_ROBIN / TIME_BASED) is not considered.
     */
    boolean existsByInstituteId(String instituteId);
}
