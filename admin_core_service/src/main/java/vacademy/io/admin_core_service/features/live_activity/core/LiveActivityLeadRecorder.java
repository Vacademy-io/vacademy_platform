package vacademy.io.admin_core_service.features.live_activity.core;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.live_activity.dto.LiveActivityEvent;
import vacademy.io.admin_core_service.features.live_activity.enums.LiveActivityAction;
import vacademy.io.admin_core_service.features.live_activity.enums.LiveActivityActorType;
import vacademy.io.admin_core_service.features.live_activity.enums.LiveActivityCategory;
import vacademy.io.admin_core_service.features.timeline.enums.LeadJourneyActionType;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Turns a lead journey milestone into a feed event.
 *
 * <p><b>Why this lives here and not in {@code TimelineEventService}.</b> That service is
 * deliberately free of audience dependencies, and its {@code logJourneyEvent} signature
 * carries no institute id -- so resolving one means reading the audience response and its
 * campaign. Doing that lookup here keeps the timeline package from growing a dependency on
 * the audience package just to satisfy the feed.
 *
 * <p><b>Why hooking {@code logJourneyEvent} is worth it.</b> One hook covers every intake
 * path at once: submitLead, submitLeadV2, submitCatalogueLead, submitLeadWithEnquiry, the
 * Meta / Google / Microsoft / Zoho / generic form webhooks, and walk-in registration. The
 * alternative was six separate edits that would drift apart.
 */
@Component
@RequiredArgsConstructor
public class LiveActivityLeadRecorder {

    private static final Logger log = LoggerFactory.getLogger(LiveActivityLeadRecorder.class);

    private final LiveActivityRecorder recorder;
    private final AudienceResponseRepository audienceResponseRepository;
    private final AudienceRepository audienceRepository;

    /**
     * Called for every journey event, and deliberately records almost none of them.
     *
     * <p>{@code logJourneyEvent} has 27 call sites spanning status changes, scoring,
     * assignment and follow-ups. Recording them all would bury the one thing the Leads tab
     * is for -- a new lead arriving -- under routine CRM churn. Assignment and follow-up
     * activity is not lost; it surfaces under the Counsellors category from its own hooks,
     * where it belongs.
     */
    public void recordJourneyEvent(String typeId, LeadJourneyActionType actionType) {
        if (actionType != LeadJourneyActionType.LEAD_SUBMITTED || typeId == null) {
            return;
        }
        try {
            Optional<AudienceResponse> maybeResponse = audienceResponseRepository.findById(typeId);
            if (maybeResponse.isEmpty()) {
                return;
            }
            AudienceResponse response = maybeResponse.get();

            String instituteId = resolveInstituteId(response);
            if (instituteId == null) {
                // Without a tenant the row cannot be scoped to anyone's feed, and writing it
                // unscoped would leak a lead across institutes.
                log.debug("Skipping lead live activity for {} -- institute could not be resolved",
                        typeId);
                return;
            }

            Map<String, Object> payload = new HashMap<>();
            if (response.getSourceType() != null) {
                payload.put("sourceType", response.getSourceType());
            }
            if (response.getAudienceId() != null) {
                payload.put("audienceId", response.getAudienceId());
            }

            recorder.recordAfterCommit(LiveActivityEvent.builder()
                    .instituteId(instituteId)
                    .occurredAtEpochMillis(System.currentTimeMillis())
                    .category(LiveActivityCategory.LEAD_FORM)
                    .action(LiveActivityAction.LEAD_SUBMITTED)
                    .actorType(LiveActivityActorType.PROSPECT)
                    .dedupeKey(LiveActivityDedupeKeys.forLead(response.getId()))
                    .subjectId(response.getUserId())
                    .subjectName(response.getParentName())
                    .subjectEmail(response.getParentEmail())
                    .subjectMobile(response.getParentMobile())
                    .entityId(response.getId())
                    .payload(payload)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to record live activity for lead {}: {}", typeId, e.getMessage());
        }
    }

    private String resolveInstituteId(AudienceResponse response) {
        if (response.getAudienceId() == null) {
            return null;
        }
        return audienceRepository.findById(response.getAudienceId())
                .map(audience -> audience.getInstituteId())
                .orElse(null);
    }
}
