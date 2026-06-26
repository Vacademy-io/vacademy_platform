package vacademy.io.admin_core_service.features.call_intelligence.core;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.call_intelligence.core.dto.CrmIntelligenceSettingsPojo;
import vacademy.io.admin_core_service.features.call_intelligence.persistence.entity.CallIntelligence;
import vacademy.io.admin_core_service.features.call_intelligence.persistence.repository.CallIntelligenceRepository;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;

import java.sql.Timestamp;

/**
 * Enqueues a call for transcription + LLM analysis by inserting a PENDING
 * {@link CallIntelligence} row (the DB-backed work queue). Called from the single
 * point where a recording lands in our own storage — {@code recording_storage_key}
 * being set — which is uniform across every source: Exotel/Airtel
 * ({@code RecordingTxOps}), AI/Aavtaar ({@code AiCallRecordingService}) and manual
 * uploads. That's the earliest moment we have something transcribable plus the
 * call's duration/status, so it's the right trigger.
 *
 * <p><b>Best-effort:</b> never throws — a failure here must not roll back or block
 * the recording-persistence flow that called it. <b>Idempotent:</b> a unique index
 * on {@code call_log_id} plus the existence check make re-delivery safe.
 *
 * <p>Credit balance is intentionally NOT checked here — that happens when the
 * poller dispatches the job (balance can change between enqueue and dispatch, and
 * we don't want to gate the recording flow on a credits lookup). An institute with
 * no balance simply gets the row marked SKIPPED/INSUFFICIENT_CREDITS later.
 */
@Service
@RequiredArgsConstructor
public class CallIntelligenceEnqueueService {

    private static final Logger log = LoggerFactory.getLogger(CallIntelligenceEnqueueService.class);

    private final CrmIntelligenceSettingsService settingsService;
    private final CallIntelligenceRepository repo;

    /**
     * Insert a PENDING analysis row for {@code row} if the institute has call
     * intelligence enabled for this call's source and the call clears the
     * eligibility gates. Safe to call multiple times for the same call.
     */
    public void enqueueIfEligible(TelephonyCallLog row) {
        try {
            if (row == null || row.getId() == null) return;

            CrmIntelligenceSettingsPojo settings = settingsService.get(row.getInstituteId());
            if (!settings.callsEnabled()) return;

            String source = sourceBucket(row.getProviderType());
            if (!settings.sourceEnabled(source)) return;

            // Need an actual recording in our storage to transcribe.
            if (isBlank(row.getRecordingStorageKey())) return;

            CrmIntelligenceSettingsPojo.Calls calls = settings.getCalls();
            Integer duration = row.getDurationSeconds();
            // Too-short calls (voicemail blips) carry no analyzable conversation.
            if (duration != null && duration < calls.getMinDurationSeconds()) return;
            // Connected calls only, unless the institute opted in to analyze the rest.
            if (!calls.isAnalyzeNotConnected() && duration != null && duration == 0) return;

            // Idempotent: one analysis per call.
            if (repo.existsByCallLogId(row.getId())) return;

            CallIntelligence ci = CallIntelligence.builder()
                    .callLogId(row.getId())
                    .instituteId(row.getInstituteId())
                    .counsellorUserId(row.getCounsellorUserId())
                    .responseId(row.getResponseId())
                    .userId(row.getUserId())
                    .source(source)
                    .direction(row.getDirection())
                    .callStartedAt(callStartedAt(row))
                    .durationSeconds(duration)
                    .status("PENDING")
                    .attempts(0)
                    .build();
            repo.save(ci);
            log.info("call-intelligence: enqueued call {} (institute {}, source {})",
                    row.getId(), row.getInstituteId(), source);

        } catch (org.springframework.dao.DataIntegrityViolationException dup) {
            // Lost an enqueue race — the unique index did its job. Not an error.
            log.debug("call-intelligence: call {} already enqueued (race)", row.getId());
        } catch (Exception e) {
            // Best-effort: a failure to enqueue must never break recording persistence.
            log.warn("call-intelligence: failed to enqueue call {} — skipping (recording flow unaffected)",
                    row != null ? row.getId() : null, e);
        }
    }

    /** Bucket a provider type into the source toggle keys: MANUAL | AI | TELEPHONY. */
    private static String sourceBucket(String providerType) {
        if (ProviderType.MANUAL.equals(providerType)) return "MANUAL";
        // AAVTAAR (real AI agent) and MOCK (synthetic AI for testing) are both "AI".
        if (ProviderType.AAVTAAR.equals(providerType) || ProviderType.MOCK.equals(providerType)) return "AI";
        return "TELEPHONY"; // EXOTEL, AIRTEL, and any future bridge provider
    }

    /** Best available "when the call happened" timestamp for time-based analytics. */
    private static Timestamp callStartedAt(TelephonyCallLog row) {
        if (row.getStartTime() != null) return row.getStartTime();
        if (row.getAnswerTime() != null) return row.getAnswerTime();
        return row.getCreatedAt(); // AI calls have no provider start_time
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
