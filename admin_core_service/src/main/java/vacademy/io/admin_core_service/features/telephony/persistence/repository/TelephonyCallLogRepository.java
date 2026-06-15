package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;

import java.util.List;
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

    /**
     * All calls placed/received by one counsellor in an institute — powers the
     * manager's "Calls" coaching tab in the counsellor workbench drawer.
     * Served by idx_tcl_counsellor (counsellor_user_id, created_at DESC).
     */
    Page<TelephonyCallLog> findByCounsellorUserIdAndInstituteIdOrderByCreatedAtDesc(
            String counsellorUserId, String instituteId, Pageable pageable);

    Page<TelephonyCallLog> findByResponseIdOrderByCreatedAtDesc(String responseId, Pageable pageable);

    /**
     * "Last counsellor" routing for inbound lead callbacks: the most recent
     * OUTBOUND call to this lead's phone whose counsellor_user_id was set.
     * Suffix-matches on the last 10 digits to tolerate country-code variance
     * between what Exotel sends on inbound ({@code CallFrom}) and what we
     * stored on the outbound row ({@code to_number}). Returns the counsellor
     * and lead user id together so the caller can attribute the call without
     * a second lookup.
     */
    @Query(value = """
            SELECT counsellor_user_id, user_id, response_id
            FROM telephony_call_log
            WHERE institute_id = :instituteId
              AND direction = 'OUTBOUND'
              AND counsellor_user_id IS NOT NULL
              AND RIGHT(regexp_replace(to_number, '[^0-9]', '', 'g'), 10)
                = RIGHT(regexp_replace(:leadPhone, '[^0-9]', '', 'g'), 10)
            ORDER BY created_at DESC
            LIMIT 1
            """, nativeQuery = true)
    List<Object[]> findRecentOutboundAttributionByLeadPhone(
            @Param("instituteId") String instituteId,
            @Param("leadPhone") String leadPhone);
}
