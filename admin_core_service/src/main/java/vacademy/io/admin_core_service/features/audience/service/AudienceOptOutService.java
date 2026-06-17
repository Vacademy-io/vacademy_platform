package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.enums.OptOutReason;
import vacademy.io.admin_core_service.features.audience.enums.SourceTypeEnum;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AudienceOptOutService {

    private final AudienceResponseRepository audienceResponseRepository;
    private final AudienceRepository audienceRepository;
    private final WorkflowTriggerService workflowTriggerService;
    private final CustomFieldValuesRepository customFieldValuesRepository;

    /**
     * Moves a user to the institute's opt-out audience and fires any configured
     * AUDIENCE_OPT_OUT workflow on that audience.
     *
     * Steps:
     * 1. Resolve the opt-out audience for the institute (campaign_type must contain 'OPT_OUT').
     * 2. Skip if the user is already in the opt-out audience.
     * 3. Soft-delete the most-recent active audience_response (overall_status = 'OPTED_OUT').
     * 4. Create a new audience_response in the opt-out audience:
     *    - source_type = 'OPT_OUT'
     *    - source_id   = previous audience_id  (tracks where they came from)
     * 5. Copy all custom field values from the previous response to the new opt-out entry.
     * 6. Fire the AUDIENCE_OPT_OUT workflow trigger if one is configured on the opt-out audience.
     */
    @Transactional
    public void moveUserToOptOutAudience(String userId, String instituteId, String channel) {
        moveUserToOptOutAudience(userId, instituteId, channel, OptOutReason.EXPLICIT);
    }

    /**
     * Variant carrying the opt-out {@link OptOutReason}. EXPLICIT (lead-initiated) fires the
     * AUDIENCE_OPT_OUT workflow immediately (MSG1) and anchors the drip to today. INACTIVE
     * (auto opt-out by the inactivity scan) does NOT fire the trigger — MSG1 is sent the next
     * morning by the scheduled 9 AM workflow — and anchors the drip to tomorrow.
     */
    @Transactional
    public void moveUserToOptOutAudience(String userId, String instituteId, String channel, OptOutReason reason) {
        if (reason == null) reason = OptOutReason.EXPLICIT;
        if (userId == null || userId.isBlank() || instituteId == null || instituteId.isBlank()) {
            log.warn("moveUserToOptOutAudience: missing userId or instituteId");
            return;
        }

        Optional<Audience> optOutAudienceOpt = audienceRepository.findOptOutAudienceByInstituteId(instituteId);
        if (optOutAudienceOpt.isEmpty()) {
            log.warn("No opt-out audience found for institute {}. Skipping audience move.", instituteId);
            return;
        }

        Audience optOutAudience = optOutAudienceOpt.get();
        String optOutAudienceId = optOutAudience.getId();

        if (audienceResponseRepository.existsByAudienceIdAndUserId(optOutAudienceId, userId)) {
            log.info("User {} is already in opt-out audience {} — skipping", userId, optOutAudienceId);
            return;
        }

        Optional<AudienceResponse> previousOpt =
                audienceResponseRepository.findMostRecentActiveResponseForUser(userId, instituteId);

        String previousAudienceId = null;
        String previousResponseId = null;
        if (previousOpt.isPresent()) {
            AudienceResponse previous = previousOpt.get();
            previousAudienceId = previous.getAudienceId();
            previousResponseId = previous.getId();
            previous.setOverallStatus("OPTED_OUT");
            audienceResponseRepository.save(previous);
            log.info("Soft-deleted audience_response {} (audience={}) for user {} via channel {}",
                    previous.getId(), previousAudienceId, userId, channel);
        } else {
            log.info("No active audience_response for user {} in institute {} — creating opt-out entry only",
                    userId, instituteId);
        }

        AudienceResponse optOutEntry = buildOptOutEntry(
                optOutAudience, userId, previousAudienceId, previousOpt.orElse(null), reason);
        audienceResponseRepository.save(optOutEntry);
        log.info("Created opt-out audience_response for user {} in audience {} (previousAudience={}, reason={})",
                userId, optOutAudienceId, previousAudienceId, reason);

        // Copy all custom field values from the previous response so the opt-out
        // audience retains the user's full profile data (name, phone, center, etc.)
        if (previousResponseId != null && optOutEntry.getId() != null) {
            copyCustomFieldValues(previousResponseId, optOutEntry.getId());
        }

        // EXPLICIT opt-outs send MSG1 immediately via the AUDIENCE_OPT_OUT workflow.
        // INACTIVE opt-outs intentionally do NOT — their MSG1 is sent the next morning
        // by the scheduled 9 AM workflow (day-0 on workflow_activate_day_at, which is
        // anchored to tomorrow for INACTIVE entries).
        if (reason == OptOutReason.EXPLICIT) {
            triggerOptOutWorkflow(optOutAudienceId, instituteId, userId, previousAudienceId, channel,
                    optOutEntry.getParentMobile(), optOutEntry.getParentName());
        }
    }

    private void copyCustomFieldValues(String previousResponseId, String newResponseId) {
        List<CustomFieldValues> previousValues = customFieldValuesRepository
                .findBySourceTypeAndSourceId("AUDIENCE_RESPONSE", previousResponseId);
        if (previousValues.isEmpty()) {
            log.info("No custom field values to copy from response {}", previousResponseId);
            return;
        }
        List<CustomFieldValues> copies = previousValues.stream()
                .map(cfv -> {
                    CustomFieldValues copy = new CustomFieldValues();
                    copy.setId(UUID.randomUUID().toString());
                    copy.setCustomFieldId(cfv.getCustomFieldId());
                    copy.setSourceType("AUDIENCE_RESPONSE");
                    copy.setSourceId(newResponseId);
                    copy.setType(cfv.getType());
                    copy.setTypeId(cfv.getTypeId());
                    copy.setValue(cfv.getValue());
                    return copy;
                })
                .collect(Collectors.toList());
        customFieldValuesRepository.saveAll(copies);
        log.info("Copied {} custom field values from response {} to opt-out response {}",
                copies.size(), previousResponseId, newResponseId);
    }

    private AudienceResponse buildOptOutEntry(Audience optOutAudience, String userId,
                                               String previousAudienceId, AudienceResponse previous,
                                               OptOutReason reason) {
        return AudienceResponse.builder()
                .audienceId(optOutAudience.getId())
                .userId(userId)
                .sourceType(SourceTypeEnum.OPT_OUT.name())
                .sourceId(previousAudienceId)
                // conversion_status distinguishes the two drip variants so the scheduled
                // day-0 MSG1 workflow targets only INACTIVE entries (EXPLICIT already got
                // their immediate MSG1 from the trigger).
                .conversionStatus(reason.conversionStatus())
                .workflowActivateDayAt(resolveActivateDay(reason))
                .isDuplicate(false)
                .parentName(previous != null ? previous.getParentName() : null)
                .parentEmail(previous != null ? previous.getParentEmail() : null)
                .parentMobile(previous != null ? previous.getParentMobile() : null)
                .build();
    }

    /**
     * Drip anchor for the opt-out entry. EXPLICIT → today (MSG1 already sent immediately by
     * the trigger; MSG2 is +2 days via the day-2 workflow). INACTIVE → tomorrow, so the
     * day-0 9 AM MSG1 workflow sends opt_out_inactive_day_1 the morning after detection and
     * the day-2 workflow sends opt_out_inactive_msg_2 two days after that.
     */
    private Timestamp resolveActivateDay(OptOutReason reason) {
        LocalDateTime base = LocalDateTime.now();
        return Timestamp.valueOf(reason == OptOutReason.INACTIVE ? base.plusDays(1) : base);
    }

    private void triggerOptOutWorkflow(String optOutAudienceId, String instituteId,
                                        String userId, String previousAudienceId, String channel,
                                        String parentMobile, String parentName) {
        try {
            Map<String, Object> contextData = new HashMap<>();
            contextData.put("userId", userId);
            contextData.put("previousAudienceId", previousAudienceId);
            contextData.put("channel", channel);
            // Carry the lead's contact so the AUDIENCE_OPT_OUT workflow can send MSG1 to just
            // this lead from context (no day-difference query needed for the immediate send).
            contextData.put("parentMobile", parentMobile);
            contextData.put("parentName", parentName);
            contextData.put("mobileNumber", parentMobile);

            workflowTriggerService.handleTriggerEvents(
                    WorkflowTriggerEvent.AUDIENCE_OPT_OUT.name(),
                    optOutAudienceId,
                    instituteId,
                    contextData);
            log.info("AUDIENCE_OPT_OUT workflow triggered for user {} in audience {}", userId, optOutAudienceId);
        } catch (Exception e) {
            log.error("Failed to trigger AUDIENCE_OPT_OUT workflow for user {} (non-blocking)", userId, e);
        }
    }
}
