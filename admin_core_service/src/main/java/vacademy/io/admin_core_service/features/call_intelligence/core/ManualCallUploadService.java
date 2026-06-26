package vacademy.io.admin_core_service.features.call_intelligence.core;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.telephony.enums.CallDirection;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.media.dto.FileDetailsDTO;

import java.sql.Timestamp;
import java.util.UUID;

/**
 * Ingests a call a counsellor made OFF-platform and uploaded the recording for.
 * Creates a telephony_call_log row tagged {@link ProviderType#MANUAL} with the
 * recording already in our storage, so it flows through the exact same Call
 * Intelligence pipeline as provider calls — unifying all three sources
 * (manual / telephony / AI) into one universal call record.
 */
@Service
@RequiredArgsConstructor
public class ManualCallUploadService {

    private static final Logger log = LoggerFactory.getLogger(ManualCallUploadService.class);

    private final MediaService mediaService;
    private final TelephonyCallLogRepository callLogRepo;
    private final CallIntelligenceEnqueueService enqueueService;

    /** Inputs for a manual-call upload. Lead identity (userId) is required. */
    public record ManualCallRequest(
            String instituteId,
            String userId,           // the lead's user_id (required — call log NOT NULL)
            String responseId,       // the lead/application id (optional but recommended)
            String counsellorUserId, // the caller (defaults to the acting user)
            String direction,        // OUTBOUND (default) | INBOUND
            Integer durationSeconds, // optional
            String counterpartyNumber, // the lead's phone (optional, for display)
            Long callStartedAtMillis // optional epoch millis
    ) {}

    /**
     * Store the recording and create the MANUAL call-log row, then enqueue
     * intelligence. Returns the new call log id.
     */
    public String upload(MultipartFile recording, ManualCallRequest req) {
        if (recording == null || recording.isEmpty()) {
            throw new VacademyException("Recording file is required");
        }
        if (req.instituteId() == null || req.instituteId().isBlank()) {
            throw new VacademyException("instituteId is required");
        }
        if (req.userId() == null || req.userId().isBlank()) {
            throw new VacademyException("userId (the lead) is required");
        }

        FileDetailsDTO uploaded;
        try {
            uploaded = mediaService.uploadFileV2(recording);
        } catch (Exception e) {
            throw new VacademyException("Failed to store recording: " + e.getMessage());
        }
        if (uploaded == null || uploaded.getId() == null) {
            throw new VacademyException("media_service did not return a file id");
        }

        boolean inbound = "INBOUND".equalsIgnoreCase(req.direction());
        TelephonyCallLog row = TelephonyCallLog.builder()
                .id(UUID.randomUUID().toString())
                .instituteId(req.instituteId())
                .providerType(ProviderType.MANUAL)
                .userId(req.userId())
                .responseId(req.responseId())
                .counsellorUserId(req.counsellorUserId())
                .direction(inbound ? CallDirection.INBOUND.name() : CallDirection.OUTBOUND.name())
                .toNumber(inbound ? null : req.counterpartyNumber())
                .fromNumber(inbound ? req.counterpartyNumber() : null)
                .status(CallStatus.COMPLETED.name())
                .durationSeconds(req.durationSeconds())
                .startTime(req.callStartedAtMillis() != null ? new Timestamp(req.callStartedAtMillis()) : null)
                .recordingStorageKey(uploaded.getId())
                .recordingLogged(true)
                .build()
                .markNew();
        callLogRepo.save(row);
        log.info("manual-call: stored upload for institute {} lead {} → callLog {}",
                req.instituteId(), req.userId(), row.getId());

        // Same hook as the provider recording paths — analyze if the institute has
        // call intelligence (and the MANUAL source) enabled. Best-effort.
        enqueueService.enqueueIfEligible(row);
        return row.getId();
    }
}
