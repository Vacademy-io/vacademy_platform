package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.dto.LeadStatusDTO;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.entity.LeadStatus;
import vacademy.io.admin_core_service.features.audience.entity.LeadStatusHistory;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.repository.LeadStatusHistoryRepository;
import vacademy.io.admin_core_service.features.audience.repository.LeadStatusRepository;
import vacademy.io.admin_core_service.features.timeline.enums.LeadJourneyActionType;
import vacademy.io.admin_core_service.features.timeline.service.TimelineEventService;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Manages the per-institute lead status catalog (table-backed, replacing the LEAD_SETTING JSON)
 * and a lead's current status + transition history. Also the single entry point for changing a
 * lead's status — manual or automatic — so history and the LEAD_STATUS_CHANGED trigger are always consistent.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LeadStatusService {

    private final LeadStatusRepository leadStatusRepository;
    private final LeadStatusHistoryRepository leadStatusHistoryRepository;
    private final AudienceResponseRepository audienceResponseRepository;
    private final AudienceRepository audienceRepository;
    private final WorkflowTriggerService workflowTriggerService;
    private final LeadTriggerContextBuilder leadTriggerContextBuilder;
    private final TimelineEventService timelineEventService;

    /**
     * @Lazy so the (one-way) edge to UserLeadProfileService can't trip Spring's eager
     * constructor-cycle detection. Used to mirror a per-response status change onto the
     * user's profile conversion_status (read by the side-view).
     */
    @Autowired
    @Lazy
    private UserLeadProfileService userLeadProfileService;

    /**
     * Starter statuses seeded the first time an institute opens Lead Statuses.
     * Keys align with the legacy conversion_status values (LEAD/CONVERTED/LOST) so the profile
     * widget and existing conversion logic (freeze on CONVERTED, the converted filter) stay consistent.
     * Institutes can rename these and add their own pipeline stages in Settings.
     */
    private static final String[][] DEFAULTS = {
            {"LEAD", "New", "#3b82f6", "1", "true"},
            {"CONVERTED", "Converted", "#16a34a", "2", "false"},
            {"LOST", "Lost", "#ef4444", "3", "false"},
    };

    // ── Catalog ────────────────────────────────────────────────────────────

    /** Active statuses for an institute, seeding the starter set on first access. */
    @Transactional
    public List<LeadStatus> listForInstitute(String instituteId) {
        if (leadStatusRepository.countByInstituteId(instituteId) == 0) {
            seedDefaults(instituteId);
        }
        return leadStatusRepository.findByInstituteIdAndIsActiveTrueOrderByDisplayOrderAsc(instituteId);
    }

    /**
     * Seed the New / Converted / Lost system defaults for an institute if it has none. Idempotent.
     *
     * <p>Called from the institute-signup flow so a new institute has its statuses immediately
     * (not just lazily on first GET). Runs in its OWN transaction (REQUIRES_NEW) so a failure here
     * — e.g. if the lead_status table is missing because migrations haven't run — is isolated and
     * can never roll back institute creation.</p>
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ensureDefaultsSeeded(String instituteId) {
        if (instituteId == null || instituteId.isBlank()) return;
        if (leadStatusRepository.countByInstituteId(instituteId) == 0) {
            seedDefaults(instituteId);
        }
    }

    private void seedDefaults(String instituteId) {
        Timestamp now = new Timestamp(System.currentTimeMillis());
        for (String[] d : DEFAULTS) {
            leadStatusRepository.save(LeadStatus.builder()
                    .instituteId(instituteId)
                    .statusKey(d[0])
                    .label(d[1])
                    .color(d[2])
                    .displayOrder(Integer.parseInt(d[3]))
                    .isDefault(Boolean.parseBoolean(d[4]))
                    .isActive(true)
                    .isSystem(true)   // New/Converted/Lost are non-deletable system defaults
                    .updatedAt(now)
                    .build());
        }
        log.info("[LeadStatus] Seeded {} default statuses for institute {}", DEFAULTS.length, instituteId);
    }

    @Transactional
    public LeadStatus create(String instituteId, LeadStatusDTO dto) {
        String key = normalizeKey(dto.getStatusKey(), dto.getLabel());
        leadStatusRepository.findByInstituteIdAndStatusKey(instituteId, key).ifPresent(s -> {
            throw new VacademyException("A status with key " + key + " already exists");
        });
        LeadStatus saved = leadStatusRepository.save(LeadStatus.builder()
                .instituteId(instituteId)
                .statusKey(key)
                .label(dto.getLabel())
                .color(dto.getColor())
                .displayOrder(dto.getDisplayOrder() != null ? dto.getDisplayOrder() : 0)
                .isDefault(Boolean.TRUE.equals(dto.getIsDefault()))
                .isActive(true)
                .updatedAt(new Timestamp(System.currentTimeMillis()))
                .build());
        if (Boolean.TRUE.equals(saved.getIsDefault())) {
            clearOtherDefaults(instituteId, saved.getId());
        }
        return saved;
    }

    @Transactional
    public LeadStatus update(String id, LeadStatusDTO dto) {
        LeadStatus s = leadStatusRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Lead status not found: " + id));
        if (dto.getLabel() != null) s.setLabel(dto.getLabel());
        if (dto.getColor() != null) s.setColor(dto.getColor());
        if (dto.getDisplayOrder() != null) s.setDisplayOrder(dto.getDisplayOrder());
        if (dto.getIsActive() != null) s.setIsActive(dto.getIsActive());
        if (dto.getIsDefault() != null) s.setIsDefault(dto.getIsDefault());
        s.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
        LeadStatus saved = leadStatusRepository.save(s);
        if (Boolean.TRUE.equals(saved.getIsDefault())) {
            clearOtherDefaults(saved.getInstituteId(), saved.getId());
        }
        return saved;
    }

    /** Soft delete a custom status — keeps history references valid. System defaults cannot be deleted. */
    @Transactional
    public void deactivate(String id) {
        leadStatusRepository.findById(id).ifPresent(s -> {
            if (Boolean.TRUE.equals(s.getIsSystem())) {
                throw new VacademyException("Default lead statuses (New / Converted / Lost) cannot be deleted.");
            }
            s.setIsActive(false);
            s.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
            leadStatusRepository.save(s);
        });
    }

    private void clearOtherDefaults(String instituteId, String keepId) {
        leadStatusRepository.findByInstituteIdOrderByDisplayOrderAsc(instituteId).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsDefault()) && !s.getId().equals(keepId))
                .forEach(s -> {
                    s.setIsDefault(false);
                    s.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
                    leadStatusRepository.save(s);
                });
    }

    private String normalizeKey(String key, String label) {
        String base = (key != null && !key.isBlank()) ? key : (label != null ? label : "");
        return base.trim().toUpperCase().replaceAll("\\s+", "_");
    }

    // ── A lead's current status ──────────────────────────────────────────────

    /**
     * Change a lead's status: updates audience_response.lead_status_id, records history, and emits
     * LEAD_STATUS_CHANGED. The single path for both manual and automatic status updates.
     */
    @Transactional
    public AudienceResponse changeLeadStatus(String audienceResponseId, String newStatusId,
                                             String actorUserId, String source) {
        AudienceResponse lead = audienceResponseRepository.findById(audienceResponseId)
                .orElseThrow(() -> new VacademyException("Lead not found: " + audienceResponseId));
        LeadStatus target = leadStatusRepository.findById(newStatusId)
                .orElseThrow(() -> new VacademyException("Lead status not found: " + newStatusId));

        String oldStatusId = lead.getLeadStatusId();
        if (Objects.equals(oldStatusId, newStatusId)) {
            return lead; // no-op
        }

        String instituteId = audienceRepository.findById(lead.getAudienceId())
                .map(Audience::getInstituteId).orElse(target.getInstituteId());

        lead.setLeadStatusId(newStatusId);
        AudienceResponse saved = audienceResponseRepository.save(lead);

        leadStatusHistoryRepository.save(LeadStatusHistory.builder()
                .audienceResponseId(audienceResponseId)
                .instituteId(instituteId)
                .fromStatusId(oldStatusId)
                .toStatusId(newStatusId)
                .changedByUserId(actorUserId)
                .source(source != null ? source : "MANUAL")
                .build());

        logStatusChangeToTimeline(saved, oldStatusId, target, actorUserId, source);
        emitStatusChanged(saved, instituteId, oldStatusId, target);

        // Keep the user's profile conversion_status (what the side-view reads) in sync with this
        // per-response change, so the leads list and the side-view never disagree. Best-effort —
        // a mirror failure must never roll back the status change the user just made.
        try {
            String profileUserId = saved.getUserId() != null ? saved.getUserId() : saved.getStudentUserId();
            if (profileUserId != null) {
                userLeadProfileService.mirrorConversionStatusFromLead(profileUserId, instituteId, target.getStatusKey());
            }
        } catch (Exception ex) {
            log.warn("[LeadStatus] Failed to mirror conversion_status for lead {}: {}",
                    saved.getId(), ex.getMessage());
        }
        return saved;
    }

    public List<LeadStatusHistory> getHistory(String audienceResponseId) {
        return leadStatusHistoryRepository.findByAudienceResponseIdOrderByChangedAtDesc(audienceResponseId);
    }

    private void logStatusChangeToTimeline(AudienceResponse lead, String oldStatusId,
                                            LeadStatus target, String actorUserId, String source) {
        try {
            String fromStatusKey = null;
            String fromStatusLabel = null;
            if (oldStatusId != null) {
                LeadStatus from = leadStatusRepository.findById(oldStatusId).orElse(null);
                if (from != null) {
                    fromStatusKey = from.getStatusKey();
                    fromStatusLabel = from.getLabel();
                }
            }

            LeadJourneyActionType actionType = switch (target.getStatusKey()) {
                case "CONVERTED" -> LeadJourneyActionType.LEAD_CONVERTED;
                case "LOST"      -> LeadJourneyActionType.LEAD_LOST;
                default          -> LeadJourneyActionType.STATUS_CHANGED;
            };

            String actorType = (source != null && !"MANUAL".equalsIgnoreCase(source)) ? "SYSTEM" : "ADMIN";
            String title = switch (actionType) {
                case LEAD_CONVERTED -> "Lead Converted";
                case LEAD_LOST      -> "Lead Closed";
                default             -> "Status changed to " + target.getLabel();
            };

            Map<String, Object> metadata = new java.util.LinkedHashMap<>();
            metadata.put("from_status_id", oldStatusId != null ? oldStatusId : "");
            metadata.put("from_status_key", fromStatusKey != null ? fromStatusKey : "");
            metadata.put("from_status_label", fromStatusLabel != null ? fromStatusLabel : "");
            metadata.put("to_status_id", target.getId());
            metadata.put("to_status_key", target.getStatusKey());
            metadata.put("to_status_label", target.getLabel());
            metadata.put("source", source != null ? source : "MANUAL");

            timelineEventService.logJourneyEvent(
                    "AUDIENCE_RESPONSE", lead.getId(),
                    actionType,
                    actorType, actorUserId, null,
                    title, null,
                    metadata,
                    lead.getStudentUserId());
        } catch (Exception ex) {
            log.warn("[LeadStatus] Failed to log status-change to timeline for lead {}: {}",
                    lead.getId(), ex.getMessage());
        }
    }

    private void emitStatusChanged(AudienceResponse lead, String instituteId, String oldStatusId, LeadStatus target) {
        if (instituteId == null || instituteId.isBlank()) return;
        try {
            String oldKey = oldStatusId == null ? null
                    : leadStatusRepository.findById(oldStatusId).map(LeadStatus::getStatusKey).orElse(null);
            Map<String, Object> ctx = leadTriggerContextBuilder.forLead(lead, instituteId, null, null, null);
            leadTriggerContextBuilder.put(ctx, "changeType", "LEAD_STATUS");
            leadTriggerContextBuilder.put(ctx, "oldStatus", oldKey);
            leadTriggerContextBuilder.put(ctx, "newStatus", target.getStatusKey());
            workflowTriggerService.handleTriggerEvents(
                    WorkflowTriggerEvent.LEAD_STATUS_CHANGED.name(), lead.getId(), instituteId, ctx);
        } catch (Exception ex) {
            log.warn("[LeadStatus] Failed to emit LEAD_STATUS_CHANGED for lead {}: {}",
                    lead.getId(), ex.getMessage());
        }
    }
}
