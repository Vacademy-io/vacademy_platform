package vacademy.io.admin_core_service.features.learner_offline.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineManifestVersion;

import java.util.Optional;

@Repository
public interface OfflineManifestVersionRepository extends JpaRepository<OfflineManifestVersion, String> {

    /**
     * Atomic upsert-and-bump: inserts version=1 if the row doesn't exist yet,
     * otherwise increments it. The single statement (native ON CONFLICT) is
     * what makes concurrent bumps for the same package session safe without an
     * app-level lock.
     */
    @Modifying
    @Query(value = """
            INSERT INTO offline_manifest_version (package_session_id, version, last_reason, updated_at)
            VALUES (:packageSessionId, 1, :reason, CURRENT_TIMESTAMP)
            ON CONFLICT (package_session_id)
            DO UPDATE SET version = offline_manifest_version.version + 1,
                           last_reason = EXCLUDED.last_reason,
                           updated_at = CURRENT_TIMESTAMP
            """, nativeQuery = true)
    void bump(@Param("packageSessionId") String packageSessionId, @Param("reason") String reason);

    Optional<OfflineManifestVersion> findByPackageSessionId(String packageSessionId);
}
