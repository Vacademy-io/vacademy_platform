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
     * Link an AI-voice end-of-call report to the call we placed, for providers that
     * neither echo our correlationId nor return a provider call id at placement
     * (Aavtaar): the most-recent OUTBOUND call to this phone in this institute.
     * Last-10-digit match tolerates country-code/format variance (same approach as
     * {@link #findRecentOutboundAttributionByLeadPhone}).
     */
    @Query(value = """
            SELECT * FROM telephony_call_log
            WHERE institute_id = :instituteId
              AND direction = 'OUTBOUND'
              AND RIGHT(regexp_replace(to_number, '[^0-9]', '', 'g'), 10)
                = RIGHT(regexp_replace(:phone, '[^0-9]', '', 'g'), 10)
            ORDER BY created_at DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<TelephonyCallLog> findMostRecentOutboundByPhone(
            @Param("instituteId") String instituteId,
            @Param("phone") String phone);

    /**
     * Same as {@link #findMostRecentOutboundByPhone} but binds to the OUTBOUND call
     * whose {@code created_at} is CLOSEST to the report's dial time ({@code anchor}).
     * A late end-of-call webhook (it can arrive after the next retry dial) must bind
     * to the attempt it actually describes, not whichever dial is most recent.
     */
    @Query(value = """
            SELECT * FROM telephony_call_log
            WHERE institute_id = :instituteId
              AND direction = 'OUTBOUND'
              AND RIGHT(regexp_replace(to_number, '[^0-9]', '', 'g'), 10)
                = RIGHT(regexp_replace(:phone, '[^0-9]', '', 'g'), 10)
            ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - :anchor)))
            LIMIT 1
            """, nativeQuery = true)
    Optional<TelephonyCallLog> findOutboundByPhoneNearest(
            @Param("instituteId") String instituteId,
            @Param("phone") String phone,
            @Param("anchor") java.sql.Timestamp anchor);

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

    /**
     * Airtel promoter — find OUR click2dial row to enrich with the CDR: an AIRTEL
     * OUTBOUND row for this counsellor + lead (last-10 match) that hasn't been
     * tied to a provider call id yet, placed at/after the CDR's start window.
     */
    @Query(value = """
            SELECT * FROM telephony_call_log
            WHERE provider_type = 'AIRTEL' AND direction = 'OUTBOUND'
              AND counsellor_user_id = :counsellor
              AND provider_call_id IS NULL
              AND RIGHT(regexp_replace(to_number, '[^0-9]', '', 'g'), 10) = :msisdn10
              AND created_at >= :since AND created_at <= :until
            ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - :anchor)))
            LIMIT 1
            """, nativeQuery = true)
    Optional<TelephonyCallLog> findAirtelUnmatchedOutbound(
            @Param("counsellor") String counsellorUserId,
            @Param("msisdn10") String msisdn10,
            @Param("since") java.sql.Timestamp since,
            @Param("until") java.sql.Timestamp until,
            @Param("anchor") java.sql.Timestamp anchor);

    /**
     * Airtel promoter — a call row to attach a recording to: an AIRTEL row for
     * this counsellor + counterparty (last-10 on either leg) with no recording
     * yet, recent. Either direction (lead is to_number outbound / from_number inbound).
     */
    @Query(value = """
            SELECT * FROM telephony_call_log
            WHERE provider_type = 'AIRTEL'
              AND counsellor_user_id = :counsellor
              AND recording_logged = FALSE
              AND ( RIGHT(regexp_replace(to_number,   '[^0-9]', '', 'g'), 10) = :msisdn10
                 OR RIGHT(regexp_replace(from_number, '[^0-9]', '', 'g'), 10) = :msisdn10 )
              AND created_at >= :since AND created_at <= :until
            ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - :anchor)))
            LIMIT 1
            """, nativeQuery = true)
    Optional<TelephonyCallLog> findAirtelCallForRecording(
            @Param("counsellor") String counsellorUserId,
            @Param("msisdn10") String msisdn10,
            @Param("since") java.sql.Timestamp since,
            @Param("until") java.sql.Timestamp until,
            @Param("anchor") java.sql.Timestamp anchor);
}
