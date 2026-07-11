package vacademy.io.admin_core_service.features.audience.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.dto.LeadSlaCandidate;
import vacademy.io.admin_core_service.features.audience.dto.LeadSlaConfigDTO;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.entity.LeadFollowup;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.repository.LeadFollowupRepository;
import vacademy.io.admin_core_service.features.audience.service.LeadAssignmentNotifier;
import vacademy.io.admin_core_service.features.audience.service.LeadSlaConfigService;
import vacademy.io.admin_core_service.features.audience.service.LeadTriggerContextBuilder;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Periodic, EMIT-ONLY scan for all lead automation triggers — TAT/SLA windows plus
 * counsellor-scheduled follow-ups. Previously {@code LeadSlaScheduler}; renamed because it
 * now covers more than just SLA breaches.
 *
 * <p>This scheduler detects which leads have crossed a configured boundary and emits the
 * corresponding workflow trigger via {@link WorkflowTriggerService#handleTriggerEvents}.
 * Bound workflows own email/WhatsApp/HTTP channels, templates, recipients and escalation —
 * but nothing in the workflow engine can raise a bell/system-alert, and most institutes
 * never bind a workflow to FOLLOW_UP_DUE/OVERDUE at all. So the counsellor-scheduled
 * follow-up scan additionally fires a guaranteed baseline bell notification directly via
 * {@link LeadAssignmentNotifier#notifyFollowUpDue}, independent of workflow configuration.
 * The SLA/TAT scan is unchanged — still emit-only, since it's institute-config-gated by
 * design (tatOn / followUpOn) rather than "should always notify someone."</p>
 *
 * <p>It runs two scans on a 30-minute cadence:</p>
 * <ol>
 *   <li><b>SLA scan</b> — for each institute, walks {@code findSlaCandidatesForInstitute}
 *       and emits TAT or follow-up triggers based on time-since-submission /
 *       time-since-last-counsellor-action against {@code lead_sla_config}. Dedup is
 *       DB-backed via {@code claimTatReminderStage}.</li>
 *   <li><b>Counsellor-scheduled follow-up scan</b> — walks {@code lead_followup} rows whose
 *       {@code schedule_time} has arrived (or is overdue) and emits FOLLOW_UP_DUE /
 *       FOLLOW_UP_OVERDUE. Dedup is via atomic PENDING→ONGOING→OVERDUE status transitions
 *       on the row (one-fire guarantee across replicas).</li>
 * </ol>
 *
 * <p>Both scans share the same {@link LeadTriggerContextBuilder} so ctx shape (parent
 * contact, counsellor contact, poolId, dueAt, minutesToBreach) is identical regardless of
 * which path emitted the event — workflows bound to FOLLOW_UP_DUE fire for either source.
 * On the user-scheduled path, ctx additionally carries {@code followupId} and
 * {@code followupContent} so workflows can branch on source if needed.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LeadAutomationScheduler {

    /** A counsellor-scheduled follow-up is treated as overdue this long after schedule_time. */
    private static final long FOLLOWUP_OVERDUE_THRESHOLD_MINUTES = 30;

    private final AudienceResponseRepository audienceResponseRepository;
    private final LeadFollowupRepository leadFollowupRepository;
    private final LeadSlaConfigService leadSlaConfigService;
    private final WorkflowTriggerService workflowTriggerService;
    private final LeadTriggerContextBuilder ctxBuilder;
    private final LeadAssignmentNotifier leadAssignmentNotifier;

    /** 30-minute cadence (server timezone). "Before" reminder windows shorter than the scan
     *  interval may be skipped, so configure before-windows of 30 minutes or more. */
    @Scheduled(cron = "0 */30 * * * ?")
    public void scan() {
        scanLeadSlas();
        scanScheduledFollowups();
    }

    // ─────────────────────────────────────────────────────────────────────
    // SLA scan — TAT + follow-up SLA windows from lead_sla_config
    // ─────────────────────────────────────────────────────────────────────

    private void scanLeadSlas() {
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
        // Pool scope: lets pool-scoped triggers (event_applied_type=POOL, eventId=poolId) fire
        // alongside institute-level ones. Null when the lead's audience isn't pooled.
        ctxBuilder.put(ctx, "poolId", ctxBuilder.resolvePoolId(c.getAudienceId()));
        ctxBuilder.put(ctx, "campaignName", c.getCampaignName());
        ctxBuilder.put(ctx, "counselorId", counselorId);
        // Look up counselor email/mobile so workflows can default to "send to counsellor".
        ctxBuilder.enrichCounselorContact(ctx, counselorId);
        ctxBuilder.put(ctx, "parentName", c.getParentName());
        ctxBuilder.put(ctx, "parentEmail", c.getParentEmail());
        ctxBuilder.put(ctx, "parentMobile", c.getParentMobile());
        // Same values under cleaner lead-* keys (the lead list's "lead" IS the user).
        ctxBuilder.put(ctx, "leadName", c.getParentName());
        ctxBuilder.put(ctx, "leadEmail", c.getParentEmail());
        ctxBuilder.put(ctx, "leadMobile", c.getParentMobile());
        ctxBuilder.put(ctx, "tatStage", emission.canonicalStage);
        ctxBuilder.put(ctx, "stageLabel", emission.stageLabel);
        if (notifyRoles != null && !notifyRoles.isEmpty()) {
            ctxBuilder.put(ctx, "notifyRoles", notifyRoles);
        }
        ctxBuilder.put(ctx, "dueAt", emission.dueAt.toString());
        ctxBuilder.put(ctx, "minutesToBreach", Math.max(0, (emission.dueAt.getEpochSecond() - now.getEpochSecond()) / 60));
        // Surface the institute's configured TAT so templates can render copy like
        // "Please reach out before {{tat}}". Falls back gracefully when not configured.
        Integer tatHours = config.getTatReminder() != null ? config.getTatReminder().getTatHours() : null;
        if (tatHours != null) {
            ctxBuilder.put(ctx, "tatHours", tatHours);
            ctxBuilder.put(ctx, "tat", tatHours == 1 ? "1 hour" : tatHours + " hours");
        } else {
            ctxBuilder.put(ctx, "tat", "the earliest");
        }

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

    // ─────────────────────────────────────────────────────────────────────
    // Counsellor-scheduled follow-up scan — from lead_followup table
    //
    // Lifecycle: PENDING → ONGOING (DUE fired) → OVERDUE (OVERDUE fired) → COMPLETED.
    // The two atomic UPDATEs (claimDueTransition / claimOverdueTransition) act as the
    // dedup gate, so each row fires its event exactly once even across replicas.
    // ─────────────────────────────────────────────────────────────────────

    private void scanScheduledFollowups() {
        Instant now = Instant.now();
        Timestamp nowTs = Timestamp.from(now);
        Timestamp overdueAt = Timestamp.from(
                now.minus(FOLLOWUP_OVERDUE_THRESHOLD_MINUTES, ChronoUnit.MINUTES));

        int dueEmitted = 0;
        int overdueEmitted = 0;

        for (LeadFollowup fu : leadFollowupRepository.findDueCandidates(nowTs)) {
            if (leadFollowupRepository.claimDueTransition(fu.getId()) == 1
                    && emitFollowup(fu, WorkflowTriggerEvent.FOLLOW_UP_DUE.name(),
                            LeadTriggerContextBuilder.STAGE_FOLLOW_UP_DUE)) {
                dueEmitted++;
            }
        }

        for (LeadFollowup fu : leadFollowupRepository.findOverdueCandidates(overdueAt)) {
            if (leadFollowupRepository.claimOverdueTransition(fu.getId()) == 1
                    && emitFollowup(fu, WorkflowTriggerEvent.FOLLOW_UP_OVERDUE.name(),
                            LeadTriggerContextBuilder.STAGE_FOLLOW_UP_OVERDUE)) {
                overdueEmitted++;
            }
        }

        if (dueEmitted > 0 || overdueEmitted > 0) {
            log.info("[LeadFollowup] Emitted {} due + {} overdue triggers this run",
                    dueEmitted, overdueEmitted);
        }
    }

    private boolean emitFollowup(LeadFollowup fu, String eventName, String stage) {
        try {
            AudienceResponse ar = audienceResponseRepository
                    .findById(fu.getAudienceResponseId()).orElse(null);
            // The follow-up's creator is its natural counsellor (the user who scheduled it),
            // so use them for ctx counselor enrichment — without this, forLead receives a
            // null counselorId and counselorEmail / counselorMobile never land in ctx, so
            // "Send to counsellor" workflows have no address to send to.
            String counselorId = fu.getCreatedBy();
            // forLead enriches parent contact + counsellor email/mobile + poolId from the
            // linked audience_response, so communication workflows have a recipient out of
            // the box (matches the SLA scan's ctx shape).
            Map<String, Object> ctx = ctxBuilder.forLead(ar, fu.getInstituteId(), null, counselorId, null);
            ctxBuilder.put(ctx, "tatStage", stage);
            ctxBuilder.put(ctx, "stageLabel", stage);
            ctxBuilder.put(ctx, "followupId", fu.getId());
            ctxBuilder.put(ctx, "followupContent", fu.getContent());
            if (fu.getScheduleTime() != null) {
                Instant due = fu.getScheduleTime().toInstant();
                ctxBuilder.put(ctx, "dueAt", due.toString());
                long minutes = (due.getEpochSecond() - Instant.now().getEpochSecond()) / 60;
                ctxBuilder.put(ctx, "minutesToBreach", Math.max(0, minutes));
            }

            // Guaranteed baseline bell alert to the counsellor who scheduled this follow-up —
            // fires regardless of whether the institute has a custom workflow bound to this
            // event (most don't), and regardless of whether the trigger emission below
            // succeeds. See class javadoc.
            boolean overdue = WorkflowTriggerEvent.FOLLOW_UP_OVERDUE.name().equals(eventName);
            leadAssignmentNotifier.notifyFollowUpDue(
                    fu.getInstituteId(), counselorId, (String) ctx.get("leadName"), overdue);

            // eventId = followup id so EVENT_BASED idempotency dedups per follow-up row,
            // not per lead — a lead can have many follow-ups over time.
            workflowTriggerService.handleTriggerEvents(
                    eventName, fu.getId(), fu.getInstituteId(), ctx);
            return true;
        } catch (Exception ex) {
            log.warn("[LeadFollowup] Failed to emit {} for followup {}: {}",
                    eventName, fu.getId(), ex.getMessage());
            return false;
        }
    }
}
