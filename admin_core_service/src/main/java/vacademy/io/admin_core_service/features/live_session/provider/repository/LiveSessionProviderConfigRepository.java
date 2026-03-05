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

    Optional<LiveSessionProviderConfig> findByInstituteIdAndProviderAndStatusIn(
            String instituteId, String provider, List<String> statuses);

    List<LiveSessionProviderConfig> findByInstituteIdAndStatusIn(
            String instituteId, List<String> statuses);

    boolean existsByInstituteIdAndProviderAndStatusIn(
            String instituteId, String provider, List<String> statuses);

    /**
     * Used by the hourly scheduler — find all ACTIVE configs for a given provider
     */
    @Query("SELECT c FROM LiveSessionProviderConfig c WHERE c.status = 'ACTIVE' AND c.provider = :provider")
    List<LiveSessionProviderConfig> findAllActiveByProvider(@Param("provider") String provider);
}
