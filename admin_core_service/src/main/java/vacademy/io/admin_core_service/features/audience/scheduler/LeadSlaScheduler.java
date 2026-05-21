package vacademy.io.admin_core_service.features.audience.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.dto.LeadSlaCandidate;
import vacademy.io.admin_core_service.features.audience.dto.LeadSlaConfigDTO;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.service.LeadSlaConfigService;
import vacademy.io.admin_core_service.features.audience.service.LeadTriggerContextBuilder;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Periodic, EMIT-ONLY scan for lead TAT (turnaround-time) and follow-up SLA breaches.
 *
 * <p>The backend never sends notifications. This scheduler only detects which leads have entered a
 * configured "before TAT", "TAT overdue", "follow-up due" or "follow-up overdue" window and emits the
 * corresponding workflow trigger via {@link WorkflowTriggerService#handleTriggerEvents}. The institute's
 * workflow (bound in the Automations UI) owns channels, templates, recipients and escalation.</p>
 *
 * <p>Config lives in the {@code lead_sla_config} tables (read via {@link LeadSlaConfigService}). Dedup is
 * DB-backed on {@code audience_response} via an atomic conditional update ({@code claimTatReminderStage}) so
 * each stage fires once per cycle, replica-safe.</p>
 *
 * <p>Cycles: a lead is in the TAT cycle until its assigned counselor first acts (any timeline_event by that
 * counselor), then in the follow-up cycle anchored on the counselor's last action (recurring — each new
 * action restarts it).</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LeadSlaScheduler {

    private final AudienceResponseRepository audienceResponseRepository;
    private final LeadSlaConfigService leadSlaConfigService;
    private final WorkflowTriggerService workflowTriggerService;
    private final LeadTriggerContextBuilder ctxBuilder;

    /** 15-minute cadence so 30-minute "before" windows are honoured. Server timezone. */
    @Scheduled(cron = "0 */15 * * * ?")
    public void scanLeadSlas() {
        List<String> instituteIds = audienceResponseRepository.findInstituteIdsWithActiveLeads();
        if (instituteIds.isEmpty()) return;

        int emitted = 0;
        for (String instituteId : instituteIds) {
            LeadSlaConfigDTO config = readConfig(instituteId);
            if (config == null) continue;
            boolean tatOn = config.getTatReminder() != null
                    && config.getTatReminder().isEnabled()
                    && config.getTatReminder().getTatHours() != null;
            boolean followUpOn = config.getFollowUp() != null
                    && config.getFollowUp().isEnabled()
                    && config.getFollowUp().getFollowUpSlaHours() != null;
            if (!tatOn && !followUpOn) continue;

            try {
                List<LeadSlaCandidate> candidates =
                        audienceResponseRepository.findSlaCandidatesForInstitute(instituteId);
                for (LeadSlaCandidate c : candidates) {
                    if (process(c, config, tatOn, followUpOn)) emitted++;
                }
            } catch (Exception ex) {
                log.warn("[LeadSla] Scan failed for institute {}: {}", instituteId, ex.getMessage());
            }
        }
        if (emitted > 0) log.info("[LeadSla] Emitted {} SLA trigger(s) this run", emitted);
    }

    /** Returns true if a trigger was emitted for this lead. */
    private boolean process(LeadSlaCandidate c, LeadSlaConfigDTO config, boolean tatOn, boolean followUpOn) {
        String counselorId = c.getCounselorId();
        if (counselorId == null || c.getSubmittedAt() == null) return false;
        Instant now = Instant.now();

        boolean acted = c.getLastCounselorActionAt() != null;

        Emission emission;
        long cycleAnchorEpoch;
        List<String> notifyRoles;
        if (!acted) {
            if (!tatOn) return false;
            LeadSlaConfigDTO.TatReminder tat = config.getTatReminder();
            Instant due = c.getSubmittedAt().toInstant().plusSeconds(tat.getTatHours() * 3600L);
            emission = resolveTatStage(now, due, tat);
            cycleAnchorEpoch = c.getSubmittedAt().getTime();
            notifyRoles = tat.getNotifyRoles();
        } else {
            if (!followUpOn) return false;
            LeadSlaConfigDTO.FollowUp fu = config.getFollowUp();
            Instant due = c.getLastCounselorActionAt().toInstant().plusSeconds(fu.getFollowUpSlaHours() * 3600L);
            emission = resolveFollowUpStage(now, due, fu);
            cycleAnchorEpoch = c.getLastCounselorActionAt().getTime();
            notifyRoles = fu.getNotifyRoles();
        }
        if (emission == null) return false;

        String dedupKey = c.getLeadId() + "|" + counselorId + "|" + cycleAnchorEpoch + "|" + emission.stageLabel;

        // Atomic claim — returns 1 only if this stage+cycle hasn't been emitted yet (replica-safe).
        int claimed = audienceResponseRepository.claimTatReminderStage(
                c.getLeadId(), dedupKey, emission.canonicalStage, counselorId,
                Timestamp.from(emission.dueAt));
        if (claimed != 1) return false;

        Map<String, Object> ctx = new HashMap<>();
        ctxBuilder.put(ctx, "instituteId", c.getInstituteId());
        ctxBuilder.put(ctx, "leadId", c.getLeadId());
        ctxBuilder.put(ctx, "userId", c.getUserId());
        ctxBuilder.put(ctx, "studentUserId", c.getStudentUserId());
        ctxBuilder.put(ctx, "enquiryId", c.getEnquiryId());
        ctxBuilder.put(ctx, "audienceId", c.getAudienceId());
        ctxBuilder.put(ctx, "campaignName", c.getCampaignName());
        ctxBuilder.put(ctx, "counselorId", counselorId);
        ctxBuilder.put(ctx, "parentName", c.getParentName());
        ctxBuilder.put(ctx, "parentEmail", c.getParentEmail());
        ctxBuilder.put(ctx, "parentMobile", c.getParentMobile());
        ctxBuilder.put(ctx, "tatStage", emission.canonicalStage);
        ctxBuilder.put(ctx, "stageLabel", emission.stageLabel);
        if (notifyRoles != null && !notifyRoles.isEmpty()) {
            ctxBuilder.put(ctx, "notifyRoles", notifyRoles);
        }
        ctxBuilder.put(ctx, "dueAt", emission.dueAt.toString());
        ctxBuilder.put(ctx, "minutesToBreach", Math.max(0, (emission.dueAt.getEpochSecond() - now.getEpochSecond()) / 60));

        try {
            workflowTriggerService.handleTriggerEvents(emission.triggerKey, c.getLeadId(), c.getInstituteId(), ctx);
            return true;
        } catch (Exception ex) {
            log.warn("[LeadSla] Failed to emit {} for lead {}: {}", emission.triggerKey, c.getLeadId(), ex.getMessage());
            return false;
        }
    }

    /** TAT cycle: OVERDUE if past due, else the most-urgent reached "before" window, else null. */
    private Emission resolveTatStage(Instant now, Instant due, LeadSlaConfigDTO.TatReminder tat) {
        if (!now.isBefore(due)) {
            String triggerKey = tat.getOverdueTrigger() != null && tat.getOverdueTrigger().getTriggerKey() != null
                    ? tat.getOverdueTrigger().getTriggerKey()
                    : WorkflowTriggerEvent.LEAD_TAT_OVERDUE.name();
            return new Emission(LeadTriggerContextBuilder.STAGE_TAT_OVERDUE, "OVERDUE", triggerKey, due);
        }
        if (tat.getBeforeTatTriggers() == null) return null;
        LeadSlaConfigDTO.BeforeTrigger best = null;
        for (LeadSlaConfigDTO.BeforeTrigger w : tat.getBeforeTatTriggers()) {
            if (w == null || w.getBeforeMinutes() == null) continue;
            Instant windowStart = due.minusSeconds(w.getBeforeMinutes() * 60L);
            if (!now.isBefore(windowStart)
                    && (best == null || w.getBeforeMinutes() < best.getBeforeMinutes())) {
                best = w;
            }
        }
        if (best == null) return null;
        String triggerKey = best.getTriggerKey() != null
                ? best.getTriggerKey() : WorkflowTriggerEvent.LEAD_TAT_REMINDER_BEFORE.name();
        String stageLabel = best.getStage() != null ? best.getStage() : ("BEFORE_" + best.getBeforeMinutes() + "M");
        return new Emission(LeadTriggerContextBuilder.STAGE_TAT_BEFORE, stageLabel, triggerKey, due);
    }

    /** Follow-up cycle: OVERDUE if past due, else the "before" window if reached, else null. */
    private Emission resolveFollowUpStage(Instant now, Instant due, LeadSlaConfigDTO.FollowUp fu) {
        if (!now.isBefore(due)) {
            String triggerKey = fu.getOverdueTrigger() != null && fu.getOverdueTrigger().getTriggerKey() != null
                    ? fu.getOverdueTrigger().getTriggerKey()
                    : WorkflowTriggerEvent.FOLLOW_UP_OVERDUE.name();
            return new Emission(LeadTriggerContextBuilder.STAGE_FOLLOW_UP_OVERDUE, "FOLLOW_UP_OVERDUE", triggerKey, due);
        }
        LeadSlaConfigDTO.BeforeTrigger before = fu.getBeforeFollowUpTrigger();
        if (before == null || before.getBeforeMinutes() == null) return null;
        Instant windowStart = due.minusSeconds(before.getBeforeMinutes() * 60L);
        if (now.isBefore(windowStart)) return null;
        String triggerKey = before.getTriggerKey() != null
                ? before.getTriggerKey() : WorkflowTriggerEvent.FOLLOW_UP_DUE.name();
        return new Emission(LeadTriggerContextBuilder.STAGE_FOLLOW_UP_DUE, "FOLLOW_UP_DUE", triggerKey, due);
    }

    private LeadSlaConfigDTO readConfig(String instituteId) {
        try {
            return leadSlaConfigService.getSchedulerConfig(instituteId);
        } catch (Exception ex) {
            log.debug("[LeadSla] No usable SLA config for institute {}: {}", instituteId, ex.getMessage());
            return null;
        }
    }

    /** Resolved stage to emit for a lead. */
    private static final class Emission {
        final String canonicalStage; // persisted on the row + drives the badge
        final String stageLabel;     // part of the dedup key (distinguishes multiple before-windows)
        final String triggerKey;     // workflow trigger event name to emit
        final Instant dueAt;         // SLA deadline for this cycle
        Emission(String canonicalStage, String stageLabel, String triggerKey, Instant dueAt) {
            this.canonicalStage = canonicalStage;
            this.stageLabel = stageLabel;
            this.triggerKey = triggerKey;
            this.dueAt = dueAt;
        }
    }
}
