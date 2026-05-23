package vacademy.io.auth_service.feature.vimotion.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.auth_service.feature.vimotion.entity.InviteCode;

import java.util.Optional;

@Repository
public interface InviteCodeRepository extends JpaRepository<InviteCode, String> {

    Optional<InviteCode> findByCode(String code);

    Page<InviteCode> findByKind(String kind, Pageable pageable);

    Page<InviteCode> findByStatus(String status, Pageable pageable);

    Page<InviteCode> findByKindAndStatus(String kind, String status, Pageable pageable);

    long countByStatus(String status);

    /**
     * Atomically increments used_count for an active code that still has uses
     * remaining (or has no cap). Returns 1 on success, 0 if the code is already
     * exhausted/revoked/expired/missing — caller treats 0 as a race-condition
     * failure.
     */
    @Modifying
    @Query(value = "UPDATE vimotion_invite_code "
            + "SET used_count = used_count + 1, "
            + "    status = CASE "
            + "        WHEN kind = 'locked' THEN 'exhausted' "
            + "        WHEN max_uses IS NOT NULL AND used_count + 1 >= max_uses THEN 'exhausted' "
            + "        ELSE status "
            + "    END "
            + "WHERE id = :id "
            + "  AND status = 'active' "
            + "  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) "
            + "  AND (max_uses IS NULL OR used_count < max_uses)",
            nativeQuery = true)
    int incrementUsage(@Param("id") String id);
}
