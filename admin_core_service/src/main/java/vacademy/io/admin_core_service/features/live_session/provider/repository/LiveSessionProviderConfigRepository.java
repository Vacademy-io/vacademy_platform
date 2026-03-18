package vacademy.io.admin_core_service.features.live_session.provider.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.provider.entity.LiveSessionProviderConfig;

import java.util.List;
import java.util.Optional;

/**
 * Mirrors InstitutePaymentGatewayMappingRepository.
 */
@Repository
public interface LiveSessionProviderConfigRepository
        extends JpaRepository<LiveSessionProviderConfig, String> {

    // ── Institute-wide (vendorUserId IS NULL) — backward-compatible ──────────

    Optional<LiveSessionProviderConfig> findByInstituteIdAndProviderAndStatusIn(
            String instituteId, String provider, List<String> statuses);

    List<LiveSessionProviderConfig> findByInstituteIdAndStatusIn(
            String instituteId, List<String> statuses);

    boolean existsByInstituteIdAndProviderAndStatusIn(
            String instituteId, String provider, List<String> statuses);

    // ── Per-organizer (vendorUserId IS NOT NULL) ──────────────────────────────

    Optional<LiveSessionProviderConfig> findByInstituteIdAndProviderAndVendorUserIdAndStatusIn(
            String instituteId, String provider, String vendorUserId, List<String> statuses);

    boolean existsByInstituteIdAndProviderAndVendorUserIdAndStatusIn(
            String instituteId, String provider, String vendorUserId, List<String> statuses);

    // ── Scheduler ────────────────────────────────────────────────────────────

    /**
     * Used by the hourly scheduler — find all ACTIVE configs for a given provider.
     */
    @Query("SELECT c FROM LiveSessionProviderConfig c WHERE c.status = 'ACTIVE' AND c.provider = :provider")
    List<LiveSessionProviderConfig> findAllActiveByProvider(@Param("provider") String provider);

    /**
     * Find Vacademy-level config (instituteId IS NULL) by provider and status.
     * Used for BBB which is a platform-wide provider, not per-institute.
     */
    @Query("SELECT c FROM LiveSessionProviderConfig c WHERE c.instituteId IS NULL AND c.provider = :provider AND c.status IN :statuses")
    Optional<LiveSessionProviderConfig> findByProviderAndStatusIn(
            @Param("provider") String provider, @Param("statuses") List<String> statuses);
}
