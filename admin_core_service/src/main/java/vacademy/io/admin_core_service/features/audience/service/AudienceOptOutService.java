package vacademy.io.admin_core_service.features.audience.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.enums.SourceTypeEnum;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AudienceOptOutService {

    private final AudienceResponseRepository audienceResponseRepository;
    private final AudienceRepository audienceRepository;
    private final WorkflowTriggerService workflowTriggerService;

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
     * 5. Fire the AUDIENCE_OPT_OUT workflow trigger if one is configured on the opt-out audience.
     */
    @Transactional
    public void moveUserToOptOutAudience(String userId, String instituteId, String channel) {
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
        if (previousOpt.isPresent()) {
            AudienceResponse previous = previousOpt.get();
            previousAudienceId = previous.getAudienceId();
            previous.setOverallStatus("OPTED_OUT");
            audienceResponseRepository.save(previous);
            log.info("Soft-deleted audience_response {} (audience={}) for user {} via channel {}",
                    previous.getId(), previousAudienceId, userId, channel);
        } else {
            log.info("No active audience_response for user {} in institute {} — creating opt-out entry only",
                    userId, instituteId);
        }

        AudienceResponse optOutEntry = buildOptOutEntry(
                optOutAudience, userId, previousAudienceId, previousOpt.orElse(null));
        audienceResponseRepository.save(optOutEntry);
        log.info("Created opt-out audience_response for user {} in audience {} (previousAudience={})",
                userId, optOutAudienceId, previousAudienceId);

        triggerOptOutWorkflow(optOutAudienceId, instituteId, userId, previousAudienceId, channel);
    }

    private AudienceResponse buildOptOutEntry(Audience optOutAudience, String userId,
                                               String previousAudienceId, AudienceResponse previous) {
        return AudienceResponse.builder()
                .audienceId(optOutAudience.getId())
                .userId(userId)
                .sourceType(SourceTypeEnum.OPT_OUT.name())
                .sourceId(previousAudienceId)
                .workflowActivateDayAt(calculateWorkflowActivateDayAt(optOutAudience))
                .isDuplicate(false)
                .parentName(previous != null ? previous.getParentName() : null)
                .parentEmail(previous != null ? previous.getParentEmail() : null)
                .parentMobile(previous != null ? previous.getParentMobile() : null)
                .build();
    }

    private void triggerOptOutWorkflow(String optOutAudienceId, String instituteId,
                                        String userId, String previousAudienceId, String channel) {
        try {
            Map<String, Object> contextData = new HashMap<>();
            contextData.put("userId", userId);
            contextData.put("previousAudienceId", previousAudienceId);
            contextData.put("channel", channel);

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

    // Mirrors AudienceService.calculateWorkflowActivateDayAt — reads offset_day from settingJson
    private Timestamp calculateWorkflowActivateDayAt(Audience audience) {
        try {
            String settingJson = audience.getSettingJson();
            if (!StringUtils.hasText(settingJson)) {
                return Timestamp.valueOf(LocalDateTime.now());
            }
            JsonNode root = new ObjectMapper().readTree(settingJson);
            JsonNode offsetDayNode = root.path("workflow_setting").path("offset_day");
            if (offsetDayNode.isMissingNode() || !offsetDayNode.isNumber()) {
                return Timestamp.valueOf(LocalDateTime.now());
            }
            return Timestamp.valueOf(LocalDateTime.now().plusDays(offsetDayNode.asInt()));
        } catch (Exception e) {
            log.warn("Could not parse settingJson for opt-out audience {}, using now", audience.getId());
            return Timestamp.valueOf(LocalDateTime.now());
        }
    }
}
