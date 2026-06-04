package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;

import java.util.Optional;

@Repository
public interface TelephonyCallLogRepository extends JpaRepository<TelephonyCallLog, String> {

    Optional<TelephonyCallLog> findByProviderTypeAndProviderCallId(
            String providerType, String providerCallId);

    /**
     * Most-recent provider_number_id this lead saw — powers STICKY_PER_LEAD via
     * idx_tcl_sticky. Returns one row max.
     */
    @Query(value = """
            SELECT provider_number_id FROM telephony_call_log
            WHERE user_id = :userId AND provider_number_id IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<String> findMostRecentNumberIdForLead(@Param("userId") String userId);

    Page<TelephonyCallLog> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    Page<TelephonyCallLog> findByUserIdAndInstituteIdOrderByCreatedAtDesc(
            String userId, String instituteId, Pageable pageable);

    Page<TelephonyCallLog> findByResponseIdOrderByCreatedAtDesc(String responseId, Pageable pageable);
}
