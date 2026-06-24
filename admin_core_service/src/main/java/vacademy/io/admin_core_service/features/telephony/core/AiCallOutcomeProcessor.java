package vacademy.io.admin_core_service.features.telephony.core;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.entity.LeadStatus;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.repository.LeadStatusRepository;
import vacademy.io.admin_core_service.features.audience.service.LeadStatusService;
import vacademy.io.admin_core_service.features.audience.service.UserLeadProfileService;
import vacademy.io.admin_core_service.features.counselor_pool.service.CounselorAssignmentService;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallDecision;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;
import vacademy.io.admin_core_service.features.telephony.enums.CallDirection;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiCallResult;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionStateRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiCallResultRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.spi.dto.NormalizedCallEvent;

import java.util.Optional;
import java.util.UUID;

/**
 * Turns a landed Aavtaar end-of-call result into lead action:
 *   1. resolve the lead (outbound: by our correlation id; inbound: by phone),
 *   2. promote/upsert a telephony_call_log row (so the call + recording attach to
 *      the lead and surface on the lead profile),
 *   3. read the institute's AI_CALLING_SETTING, classify the outcome,
 *   4. ASSIGN a counsellor (good response / exhausted-to-human) or set a status.
 *
 * Idempotent: a result already PROCESSED is skipped. Status stamping is
 * best-effort — it only fires if the institute's lead-status catalog has the
 * matching key (so missing catalog entries never break the call flow).
 *
 * Deferred (tracked): copying the recording to our S3 (needs an Aavtaar fetcher),
 * and the timed retry re-dialer — RETRY here only marks the lead.
 */
@Service
@RequiredArgsConstructor
public class AiCallOutcomeProcessor {

    private static final Logger log = LoggerFactory.getLogger(AiCallOutcomeProcessor.class);

    // Lead-status catalog keys the institute should provision for stamping to work.
    private static final String STATUS_QUALIFIED = "AI_QUALIFIED";
    private static final String STATUS_NOT_INTERESTED = "AI_NOT_INTERESTED";
    private static final String STATUS_NO_ANSWER = "AI_NO_ANSWER";
    private static final String STATUS_RETRY_PENDING = "AI_RETRY_PENDING";

    private final AiCallResultRepository aiCallResultRepo;
    private final TelephonyCallLogRepository callLogRepo;
    private final AudienceResponseRepository audienceResponseRepo;
    private final LeadStatusRepository leadStatusRepo;
    private final LeadStatusService leadStatusService;
    private final CounselorAssignmentService counselorAssignmentService;
    private final UserLeadProfileService userLeadProfileService;
    private final AiCallingSettingsService settingsService;
    private final AiCallOutcomeClassifier classifier;
    private final CallLogService callLogService;
    private final WorkflowExecutionStateRepository executionStateRepository;
    private final AiCallRecordingService aiCallRecordingService;

    private record Lead(String responseId, String userId, String audienceId, String instituteId) {}

    @Transactional
    public void process(String aiCallResultId) {
        AiCallResult r = aiCallResultRepo.findById(aiCallResultId).orElse(null);
        if (r == null) return;
        if ("PROCESSED".equals(r.getProcessingStatus())) return;

        TelephonyCallLog existing = (r.getCorrelationId() == null) ? null
                : callLogRepo.findById(r.getCorrelationId()).orElse(null);
        // Exact match: when the provider returns its call id at placement (Aavtaar now
        // does), it's stored as the call log's provider_call_id and the webhook carries the
        // same id as call_uuid — binding the report to THE exact call (timing-immune,
        // and unaffected by leads sharing a phone).
        if (existing == null && r.getCallUuid() != null && r.getProvider() != null) {
            existing = callLogRepo
                    .findByProviderTypeAndProviderCallId(r.getProvider(), r.getCallUuid())
                    .orElse(null);
        }
        // Fallback (no provider call id — older calls / provider didn't return one): bind by
        // phone. The webhook can arrive LATE (after the next retry dial), so anchor on the
        // report's dial time (callStart) and pick the OUTBOUND call placed CLOSEST to
        // it, so a late report binds to the attempt it describes rather than the most
        // recent dial. Fall back to most-recent when the report carries no dial time.
        // Without this the result can't bind → call_log_id stays empty and the
        // recording/disposition/status never attach to the lead.
        // Provider-scoped: only ever bind to a call placed by THIS provider, so an
        // Aavtaar report can never attach to (and overwrite) an Exotel/Airtel call log
        // that happens to share the lead's phone number.
        if (existing == null && r.getInstituteId() != null && r.getPhoneNumber() != null
                && r.getProvider() != null) {
            var anchor = r.getCallStart();
            existing = (anchor != null)
                    ? callLogRepo.findOutboundByPhoneNearest(
                            r.getInstituteId(), r.getProvider(), r.getPhoneNumber(),
                            java.sql.Timestamp.from(anchor)).orElse(null)
                    : callLogRepo.findMostRecentOutboundByPhone(
                            r.getInstituteId(), r.getProvider(), r.getPhoneNumber()).orElse(null);
        }

        Lead lead = resolveLead(r, existing);
        String callLogId = upsertCallLog(r, lead, existing);
        if (callLogId != null) {
            r.setCallLogId(callLogId);
            // Copy the recording into our storage (media_service pre-signed URL) so it
            // plays from the lead profile's Call History. Async — never blocks the webhook.
            // Dispatch AFTER this transaction commits, so the async thread can see the
            // just-inserted call-log row (avoids a read-before-commit race for new rows).
            if (r.getRecordingUrl() != null && !r.getRecordingUrl().isBlank()) {
                final String cid = callLogId;
                if (TransactionSynchronizationManager.isSynchronizationActive()) {
                    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            aiCallRecordingService.persistAsync(cid);
                        }
                    });
                } else {
                    aiCallRecordingService.persistAsync(cid);
                }
            }
        }

        String instituteId = lead.instituteId() != null ? lead.instituteId() : r.getInstituteId();
        AiCallingSettingsPojo settings = settingsService.get(instituteId);
        int priorAttempts = r.getCallRetry() == null ? 0 : r.getCallRetry();
        AiCallDecision decision = classifier.classify(
                r.getStatus(), r.getDurationSeconds(), r.getDisposition(), priorAttempts, settings);

        log.info("ai-call outcome: result={} lead={} disposition={} status={} -> {} ({})",
                r.getId(), lead.userId(), r.getDisposition(), r.getStatus(), decision.action(), decision.reason());

        applyDecision(decision, lead);

        r.setProcessingStatus("PROCESSED");
        aiCallResultRepo.save(r);
    }

    // ── lead resolution ─────────────────────────────────────────────────────────

    private Lead resolveLead(AiCallResult r, TelephonyCallLog existing) {
        if (existing != null) {
            String audienceId = existing.getResponseId() == null ? null
                    : audienceResponseRepo.findById(existing.getResponseId())
                        .map(AudienceResponse::getAudienceId).orElse(null);
            return new Lead(existing.getResponseId(), existing.getUserId(), audienceId, existing.getInstituteId());
        }
        // Inbound (or lost correlation): match the lead by phone within the institute.
        String phone = lastDigits(r.getPhoneNumber());
        if (r.getInstituteId() == null || phone == null) {
            return new Lead(null, null, null, r.getInstituteId());
        }
        AudienceResponse ar = audienceResponseRepo
                .findByInstituteIdAndParentMobile(r.getInstituteId(), phone)
                .stream().findFirst().orElse(null);
        if (ar == null) return new Lead(null, null, null, r.getInstituteId());
        return new Lead(ar.getId(), ar.getUserId(), ar.getAudienceId(), r.getInstituteId());
    }

    // ── call-log promotion ──────────────────────────────────────────────────────

    private String upsertCallLog(AiCallResult r, Lead lead, TelephonyCallLog existing) {
        TelephonyCallLog row = existing;
        if (row == null) {
            // No prior row (inbound). telephony_call_log.user_id is NOT NULL, so we
            // can only create a row when the lead resolved to a user.
            if (lead.userId() == null) return null;
            row = TelephonyCallLog.builder()
                    .id(UUID.randomUUID().toString())
                    .instituteId(lead.instituteId() != null ? lead.instituteId() : r.getInstituteId())
                    .providerType(r.getProvider())
                    .responseId(lead.responseId())
                    .userId(lead.userId())
                    .direction(r.getDirection() != null ? r.getDirection() : CallDirection.INBOUND.name())
                    .toNumber(r.getPhoneNumber())
                    .status(CallStatus.INITIATED.name())
                    .recordingFetchAttempts(0)
                    .recordingLogged(false)
                    .build();
            row.markNew();
            callLogRepo.save(row);
        }
        // Reuse the canonical, rank-ordered idempotent update — the same path Exotel
        // uses — so duplicate/out-of-order reports can't move status backwards.
        NormalizedCallEvent ev = NormalizedCallEvent.builder()
                .correlationId(row.getId())
                .providerCallId(r.getCallUuid())
                .status(mapStatus(r.getStatus()))
                .durationSeconds(r.getDurationSeconds())
                .recordingUrl(r.getRecordingUrl())
                .terminationReason(r.getHangupCause())
                .rawPayload(r.getRawPayload())
                .build();
        callLogService.applyEvent(row, ev);
        return row.getId();
    }

    // ── actions ───────────────────────────────────────────────────────────────

    private void applyDecision(AiCallDecision decision, Lead lead) {
        switch (decision.action()) {
            case ASSIGN -> {
                assignCounsellor(lead);
                setStatus(lead, decision.isExhausted() ? STATUS_NO_ANSWER : STATUS_QUALIFIED);
                stopRetryLoop(lead); // a human owns the lead → stop the pause/resume retries
            }
            case STOP -> {
                setStatus(lead, decision.isExhausted() ? STATUS_NO_ANSWER : STATUS_NOT_INTERESTED);
                stopRetryLoop(lead); // terminal disposition (e.g. Not_Interested) → stop retrying
            }
            // RETRY: leave the paused CALL_AI workflow alone — it resumes itself and re-dials.
            case RETRY -> setStatus(lead, STATUS_RETRY_PENDING);
            case NONE -> { /* AI calling disabled — record only */ }
        }
    }

    /**
     * Cancel the lead's paused AI-call workflow (the CALL_AI pause/resume retry loop)
     * so it stops re-dialing once the outcome is terminal (assigned / not-interested).
     * Best-effort — a miss just means the loop runs one more cycle and self-stops on
     * its own assigned / max-retries gate.
     */
    private void stopRetryLoop(Lead lead) {
        if (lead.responseId() == null) return;
        try {
            int cancelled = executionStateRepository.cancelAiCallRetriesByResponseId(lead.responseId());
            if (cancelled > 0) {
                log.info("ai-call outcome: stopped {} paused retry loop(s) for lead {}", cancelled, lead.userId());
            }
        } catch (Exception e) {
            log.warn("ai-call outcome: could not cancel retry loop for response {}: {}",
                    lead.responseId(), e.getMessage());
        }
    }

    /**
     * Terminal handoff when the CALL_AI retry loop gives up (attempts hit maxRetries
     * with no pickup). Mirrors the classifier's exhausted() branch: assign the lead
     * to a human (when {@code assignExhaustedToHuman}) and stamp AI_NO_ANSWER — so an
     * exhausted no-answer lead is never silently dropped. Called by the CALL_AI node.
     */
    @Transactional
    public void giveUpAfterRetries(String responseId, String instituteId, String userId) {
        if (responseId == null || responseId.isBlank() || instituteId == null || instituteId.isBlank()) return;
        String audienceId = audienceResponseRepo.findById(responseId)
                .map(AudienceResponse::getAudienceId).orElse(null);
        Lead lead = new Lead(responseId, userId, audienceId, instituteId);
        AiCallingSettingsPojo settings = settingsService.get(instituteId);
        if (settings.isAssignExhaustedToHuman()) {
            assignCounsellor(lead);
        }
        setStatus(lead, STATUS_NO_ANSWER);
        log.info("ai-call: retries exhausted for lead {} -> AI_NO_ANSWER (assignToHuman={})",
                userId, settings.isAssignExhaustedToHuman());
    }

    private void assignCounsellor(Lead lead) {
        if (lead.audienceId() == null || lead.userId() == null) {
            log.info("ai-call assign: skipped (no audience/user) for lead {}", lead.userId());
            return;
        }
        Optional<String> counselorId = counselorAssignmentService.assignCounselorForLead(lead.audienceId());
        if (counselorId.isEmpty()) {
            log.info("ai-call assign: no counsellor returned (manual/empty pool) for audience {}", lead.audienceId());
            return;
        }
        userLeadProfileService.assignCounselor(lead.userId(), lead.instituteId(), counselorId.get(), null);
        log.info("ai-call assign: lead {} -> counsellor {}", lead.userId(), counselorId.get());
    }

    private void setStatus(Lead lead, String statusKey) {
        if (lead.instituteId() == null || lead.responseId() == null) return;
        LeadStatus status = leadStatusRepo.findByInstituteIdAndStatusKey(lead.instituteId(), statusKey).orElse(null);
        if (status == null) {
            log.debug("ai-call status: '{}' not in catalog for institute {} — skipping stamp", statusKey, lead.instituteId());
            return;
        }
        leadStatusService.changeLeadStatus(lead.responseId(), status.getId(), null, "AI_CALLING");
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    private CallStatus mapStatus(String s) {
        if (s == null) return CallStatus.COMPLETED;
        return switch (s.trim().toLowerCase()) {
            case "completed", "complete" -> CallStatus.COMPLETED;
            case "no-answer", "no_answer", "noanswer", "missed" -> CallStatus.NO_ANSWER;
            case "busy" -> CallStatus.BUSY;
            case "failed", "error" -> CallStatus.FAILED;
            case "cancelled", "canceled" -> CallStatus.CANCELLED;
            default -> CallStatus.COMPLETED;
        };
    }

    /** Last 10 digits — tolerates country-code variance when matching by phone. */
    private String lastDigits(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return null;
        return digits.length() <= 10 ? digits : digits.substring(digits.length() - 10);
    }
}
