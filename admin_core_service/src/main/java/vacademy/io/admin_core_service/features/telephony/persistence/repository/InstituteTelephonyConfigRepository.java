package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.InstituteTelephonyConfig;

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
     * Which institute owns a given Airtel VBC account. Airtel stores its account
     * id in the generic provider_config JSON, so we match on the JSON key.
     * Used by the CDR/recording promoter to attribute an S3 import to an institute.
     */
    @Query(value = """
            SELECT * FROM institute_telephony_config
            WHERE provider_type = 'AIRTEL'
              AND provider_config IS NOT NULL
              AND provider_config::jsonb ->> 'accountId' = :accountId
            LIMIT 1
            """, nativeQuery = true)
    Optional<InstituteTelephonyConfig> findAirtelConfigByAccountId(@Param("accountId") String accountId);
}
