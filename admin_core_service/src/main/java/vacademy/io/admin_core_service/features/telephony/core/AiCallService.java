package vacademy.io.admin_core_service.features.telephony.core;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.entity.UserLeadProfile;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.repository.UserLeadProfileRepository;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallRequestDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallResponseDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;
import vacademy.io.admin_core_service.features.telephony.enums.CallDirection;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallHandle;
import vacademy.io.admin_core_service.features.telephony.spi.dto.AiCallSpec;
import vacademy.io.common.exceptions.VacademyException;

import java.util.UUID;

/**
 * "Click to AI call" — places one AI call for a lead through the
 * {@code AiOutboundCaller} port (resolved by provider from
 * {@link AiVoiceProviderRegistry}). Provider-neutral: a new AI provider needs no
 * change here.
 *
 * The caller may pass only the {@code responseId} (the lead-row button + the
 * CALL_AI workflow node do): this resolves the lead's phone + user id from the
 * audience_response, and the campaignId from the institute's AI_CALLING_SETTING,
 * when they're blank — so callers don't need to know either.
 *
 * Single-leg by nature, so it does NOT use the counsellor-bridge
 * {@code CallOrchestrator}/{@code OutboundCallInitiator}. It mirrors that phased
 * shape (no DB tx across the HTTP hop): persist INITIATED → dispatch → QUEUED/FAILED.
 */
@Service
@RequiredArgsConstructor
public class AiCallService {

    private static final Logger log = LoggerFactory.getLogger(AiCallService.class);

    private final TelephonyCallLogRepository callLogRepo;
    private final AiVoiceProviderRegistry registry;
    private final AudienceResponseRepository audienceResponseRepository;
    private final AiCallingSettingsService settingsService;
    private final UserMobileResolver userMobileResolver;
    private final UserLeadProfileRepository userLeadProfileRepository;

    public AiCallResponseDTO placeCall(AiCallRequestDTO req, String counsellorUserId) {
        if (req == null || isBlank(req.getInstituteId())) {
            throw new VacademyException("instituteId is required.");
        }
        // Provider + campaign default to the institute's AI_CALLING_SETTING, so swapping
        // the AI agent is a settings change, not a code change.
        AiCallingSettingsPojo settings = settingsService.get(req.getInstituteId());
        String provider = isBlank(req.getProvider()) ? settings.getProvider() : req.getProvider();
        if (isBlank(provider)) provider = ProviderType.AAVTAAR;

        String userId = req.getUserId();
        String phone = req.getPhoneNumber();
        // Resolve phone/userId from the lead when the caller supplied only a responseId.
        if ((isBlank(userId) || isBlank(phone)) && !isBlank(req.getResponseId())) {
            AudienceResponse ar = audienceResponseRepository.findById(req.getResponseId()).orElse(null);
            if (ar != null) {
                if (isBlank(userId)) userId = ar.getUserId();
                if (isBlank(phone)) phone = ar.getParentMobile();
            }
        }
        // Fall back to the user's mobile (auth_service) when the lead has no
        // parent_mobile — the same resolution the Exotel bridge path uses, since
        // the phone shown on the lead row often comes from the user's profile.
        if (isBlank(phone) && !isBlank(userId)) {
            phone = userMobileResolver.findMobile(userId).orElse(null);
        }

        String campaignId = isBlank(req.getCampaignId()) ? settings.getDefaultCampaignId() : req.getCampaignId();

        if (isBlank(userId)) throw new VacademyException("Could not resolve the lead's user id for the call.");
        if (isBlank(phone)) throw new VacademyException("This lead has no phone number on file.");
        if (isBlank(campaignId)) {
            throw new VacademyException("No campaign configured — set a default Campaign ID in Settings → AI Calling.");
        }

        // Don't re-call a lead that's already been handed to a counsellor (AI handoff
        // or manual assignment). The bot's job ends once a human owns the lead — this
        // single guard covers the manual button, bulk campaigns and the workflow node.
        if (leadAlreadyAssigned(userId, req.getInstituteId())) {
            log.info("AI call skipped: lead {} is already assigned to a counsellor", userId);
            return AiCallResponseDTO.builder()
                    .status("SKIPPED_ASSIGNED")
                    .dispatched(false)
                    .providerMessage("Lead is already assigned to a counsellor — AI call skipped.")
                    .build();
        }

        String callLogId = UUID.randomUUID().toString();
        TelephonyCallLog row = TelephonyCallLog.builder()
                .id(callLogId)
                .instituteId(req.getInstituteId())
                .providerType(provider)
                .responseId(req.getResponseId())
                .userId(userId)
                .counsellorUserId(counsellorUserId)
                .direction(CallDirection.OUTBOUND.name())
                .toNumber(phone)
                .status(CallStatus.INITIATED.name())
                .recordingFetchAttempts(0)
                .recordingLogged(false)
                .build();
        row.markNew();
        callLogRepo.save(row);

        AiCallSpec spec = AiCallSpec.builder()
                .instituteId(req.getInstituteId())
                .leadUserId(userId)
                .responseId(req.getResponseId())
                .phoneNumber(phone)
                .campaignId(campaignId)
                .customerName(req.getCustomerName())
                .customerEmail(req.getCustomerEmail())
                .correlationId(callLogId)
                .metadata(req.getMetadata())
                .build();

        try {
            AiCallHandle handle = registry.caller(provider).placeCall(spec);
            if (handle.getProviderCallId() != null) row.setProviderCallId(handle.getProviderCallId());
            row.setStatus(handle.isAccepted() ? CallStatus.QUEUED.name() : CallStatus.FAILED.name());
            if (!handle.isAccepted()) row.setTerminationReason("provider_rejected");
            callLogRepo.save(row);

            return AiCallResponseDTO.builder()
                    .callLogId(callLogId)
                    .status(row.getStatus())
                    .dispatched(handle.isAccepted())
                    .providerMessage(handle.getMessage())
                    .build();
        } catch (Exception e) {
            row.setStatus(CallStatus.FAILED.name());
            row.setTerminationReason("provider_initiate_failure");
            callLogRepo.save(row);
            log.error("AI call failed for lead {} (callLog {})", userId, callLogId, e);
            throw new VacademyException("AI call failed: " + e.getMessage());
        }
    }

    /** True if the lead's user already has a counsellor on their lead profile. */
    private boolean leadAlreadyAssigned(String userId, String instituteId) {
        if (isBlank(userId) || isBlank(instituteId)) return false;
        return userLeadProfileRepository.findByUserIdAndInstituteId(userId, instituteId)
                .map(UserLeadProfile::getAssignedCounselorId)
                .filter(id -> id != null && !id.isBlank())
                .isPresent();
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
