package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyProviderNumber;

import java.util.List;

@Repository
public interface TelephonyProviderNumberRepository
        extends JpaRepository<TelephonyProviderNumber, String> {

    @Query("""
            SELECT n FROM TelephonyProviderNumber n
            WHERE n.configId = :configId AND n.enabled = TRUE
            ORDER BY n.priority ASC, n.id ASC
            """)
    List<TelephonyProviderNumber> findEnabledByConfigId(@Param("configId") String configId);

    @Query("""
            SELECT n FROM TelephonyProviderNumber n
            WHERE n.instituteId = :instituteId
            ORDER BY n.priority ASC, n.id ASC
            """)
    List<TelephonyProviderNumber> findByInstituteId(@Param("instituteId") String instituteId);

    /**
     * Locate which institute owns a dialled provider number. Suffix-matches
     * on the last 10 digits so format differences don't cause misses — Exotel
     * sends Indian numbers as "09513886363" (local with leading 0) while the
     * admin might have saved "+91 9513886363", "+919513886363", or just
     * "9513886363". Stripping non-digits and comparing the trailing 10 digits
     * normalises all of these.
     *
     * Returns a list rather than Optional to remain robust if the same
     * number is misconfigured across institutes — the caller picks the
     * first/preferred match.
     */
    @Query(value = """
            SELECT * FROM telephony_provider_number
            WHERE enabled = TRUE
              AND RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10)
                = RIGHT(regexp_replace(:phoneNumber, '[^0-9]', '', 'g'), 10)
            ORDER BY priority ASC, id ASC
            """, nativeQuery = true)
    List<TelephonyProviderNumber> findEnabledByPhoneNumber(@Param("phoneNumber") String phoneNumber);
}
