package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.InstituteTelephonyConfig;

import java.util.List;
import java.util.Optional;

@Repository
public interface InstituteTelephonyConfigRepository
        extends JpaRepository<InstituteTelephonyConfig, String> {

    Optional<InstituteTelephonyConfig> findByInstituteId(String instituteId);

    @Query("""
            SELECT c FROM InstituteTelephonyConfig c
            WHERE c.instituteId = :instituteId AND c.enabled = TRUE
            """)
    Optional<InstituteTelephonyConfig> findEnabledByInstituteId(
            @Param("instituteId") String instituteId);

    /**
     * All configs for a provider type (e.g. AIRTEL) — a tiny set (one per
     * institute that uses it). The CDR/recording promoter loads these and matches
     * the S3 import's account id against each config's parsed provider_config JSON
     * in Java. (We deliberately do NOT match the account id in SQL: the account id
     * lives in the generic provider_config JSON, and a brace-guarded
     * {@code ::jsonb} native query trips Hibernate's "{alias}" path parser —
     * "Unmatched braces for alias path".)
     */
    List<InstituteTelephonyConfig> findByProviderType(String providerType);
}
