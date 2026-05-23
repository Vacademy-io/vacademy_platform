package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.dto.UserAudienceMembershipDTO;
import vacademy.io.admin_core_service.features.audience.dto.UserLeadProfileDTO;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.entity.LeadScore;
import vacademy.io.admin_core_service.features.audience.entity.UserLeadProfile;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.repository.LeadScoreRepository;
import vacademy.io.admin_core_service.features.audience.repository.UserLeadProfileRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionLogsRepository;
import vacademy.io.admin_core_service.features.timeline.repository.TimelineEventRepository;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;
import vacademy.io.common.auth.dto.UserDTO;

import java.sql.Timestamp;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Builds and maintains aggregated lead profiles at the user level.
 *
 * <p>The profile aggregates the best score across all campaigns a user has
 * submitted to within an institute. It is the single source of truth shown
 * in /manage-students and /manage-contacts sidebars.</p>
 *
 * <p>Update triggers:
 * <ol>
 *   <li>Real-time: after any LeadScore save (called by LeadScoringService)</li>
 *   <li>Batch: every 30 minutes via {@link #batchRebuildProfiles()}</li>
 * </ol>
 * </p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserLeadProfileService {

    private final UserLeadProfileRepository userLeadProfileRepository;
    private final AudienceResponseRepository audienceResponseRepository;
    private final AudienceRepository audienceRepository;
    private final LeadScoreRepository leadScoreRepository;
    private final LiveSessionLogsRepository liveSessionLogsRepository;
    private final TimelineEventRepository timelineEventRepository;
    private final WorkflowTriggerService workflowTriggerService;
    private final LeadTriggerContextBuilder leadTriggerContextBuilder;
    private final AuthService authService;

    /**
     * @Lazy breaks the cycle with LeadScoringService (which already injects this
     * service). Spring proxies the bean so it's only resolved on first use.
     */
    @Autowired
    @Lazy
    private LeadScoringService leadScoringService;

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build or update the lead profile for a single user.
     * Called in real-time after a score is computed.
     *
     * @param userId      Auth user ID (parent or student)
     * @param instituteId Institute the campaign belongs to
     */
    @Transactional
    public UserLeadProfile buildOrUpdateProfile(String userId, String instituteId) {
        if (userId == null || instituteId == null) return null;

        // Load all audience responses for this user (both parent and student roles)
        List<AudienceResponse> responses = audienceResponseRepository
                .findByUserIdOrStudentUserId(userId, userId);

        // Filter to this institute only (responses contain audience_id; we need instituteId match)
        // We derive the institute by reading it from existing lead scores which store instituteId.
        List<String> responseIds = responses.stream()
                .map(AudienceResponse::getId)
                .collect(Collectors.toList());

        List<LeadScore> scores = responseIds.isEmpty()
                ? Collections.emptyList()
                : leadScoreRepository.findByAudienceResponseIdIn(responseIds);

        // Filter scores to this institute
        List<LeadScore> instituteScores = scores.stream()
                .filter(s -> instituteId.equals(s.getInstituteId()))
                .collect(Collectors.toList());

        // Find existing profile or create new
        UserLeadProfile profile = userLeadProfileRepository
                .findByUserIdAndInstituteId(userId, instituteId)
                .orElse(UserLeadProfile.builder()
                        .userId(userId)
                        .instituteId(instituteId)
                        .build());

        // Don't update score if already CONVERTED
        if (!"CONVERTED".equals(profile.getConversionStatus())) {
            updateScoreFields(profile, instituteScores, responses);
        }

        // Always update activity counts
        updateActivityCounts(profile, userId, instituteScores);

        profile.setLastCalculatedAt(new Timestamp(System.currentTimeMillis()));
        profile.setUpdatedAt(new Timestamp(System.currentTimeMillis()));

        return userLeadProfileRepository.save(profile);
    }

    /**
     * Auto-mark conversion on enrollment, but only if a lead profile already exists.
     *
     * Used by the enrollment flow so a user who came in as a lead (had a campaign
     * submission, was contacted, etc.) is automatically removed from open-lead views
     * once they enroll. Users who enroll directly without ever being a lead do not get
     * a profile created — they were never tracked, so there's nothing to convert.
     *
     * Returns true if a profile existed and was marked converted; false otherwise.
     */
    @Transactional
    public boolean markConvertedIfExists(String userId, String instituteId) {
        if (userId == null || instituteId == null) return false;
        return userLeadProfileRepository
                .findByUserIdAndInstituteId(userId, instituteId)
                .map(profile -> {
                    Timestamp now = new Timestamp(System.currentTimeMillis());
                    profile.setConversionStatus("CONVERTED");
                    profile.setConvertedAt(now);
                    // Note: first_response_at is NOT stamped here. TAT is measured strictly as
                    // counsellor-activity time (MIN timeline_event by counsellor), not status flips.
                    profile.setUpdatedAt(now);
                    userLeadProfileRepository.save(profile);
                    return true;
                })
                .orElse(false);
    }

    /**
     * Mark a user's lead as CONVERTED. Freezes score updates.
     * Called by admin when manually marking as converted, or automatically on enrollment.
     */
    @Transactional
    public UserLeadProfile markConverted(String userId, String instituteId) {
        UserLeadProfile profile = userLeadProfileRepository
                .findByUserIdAndInstituteId(userId, instituteId)
                .orElseGet(() -> UserLeadProfile.builder()
                        .userId(userId)
                        .instituteId(instituteId)
                        .build());

        Timestamp now = new Timestamp(System.currentTimeMillis());
        profile.setConversionStatus("CONVERTED");
        profile.setConvertedAt(now);
        // Note: first_response_at is NOT stamped here. TAT is measured strictly as
        // counsellor-activity time (MIN timeline_event by counsellor), not status flips.
        profile.setUpdatedAt(now);
        return userLeadProfileRepository.save(profile);
    }

    /**
     * Update the conversion status of a lead profile.
     * Valid statuses: LEAD, CONVERTED, LOST.
     * Setting to CONVERTED freezes score updates; setting back to LEAD unfreezes them.
     */
    @Transactional
    public UserLeadProfile updateConversionStatus(String userId, String instituteId, String status) {
        UserLeadProfile profile = userLeadProfileRepository
                .findByUserIdAndInstituteId(userId, instituteId)
                .orElseGet(() -> UserLeadProfile.builder()
                        .userId(userId)
                        .instituteId(instituteId)
                        .build());

        String oldStatus = profile.getConversionStatus();
        Timestamp now = new Timestamp(System.currentTimeMillis());
        profile.setConversionStatus(status);
        profile.setUpdatedAt(now);

        if ("CONVERTED".equals(status)) {
            profile.setConvertedAt(now);
        } else {
            profile.setConvertedAt(null);
        }
        // Note: first_response_at is NOT stamped here. TAT is measured strictly as the time
        // the counsellor took to log their first activity (timeline_event by the assigned
        // counsellor) — status changes by admins don't count toward TAT.

        UserLeadProfile saved = userLeadProfileRepository.save(profile);
        emitStatusChanged(saved, "CONVERSION_STATUS", oldStatus, status);
        return saved;
    }

    /**
     * Manually override the lead tier (HOT, WARM, COLD).
     *
     * Only sets lead_tier — best_score is left intact so the formula's output remains
     * visible alongside the override. Frontends should resolve the active tier as
     * "explicit lead_tier wins, else infer from best_score".
     *
     * Previously this method also wrote best_score = 20/60/90 which silently destroyed
     * the formula output and made it impossible to tell why a profile was at 20.
     */
    @Transactional
    public UserLeadProfile updateLeadTier(String userId, String instituteId, String tier) {
        UserLeadProfile profile = userLeadProfileRepository
                .findByUserIdAndInstituteId(userId, instituteId)
                .orElseGet(() -> UserLeadProfile.builder()
                        .userId(userId)
                        .instituteId(instituteId)
                        .build());

        String oldTier = profile.getLeadTier();
        String requested = tier.toUpperCase();
        String scoreDerived = profile.computeTier();

        // If the admin is requesting the tier the score would derive anyway, clear
        // lead_tier instead of storing it. The frontend falls back to score-derived
        // tier when lead_tier is null, so this acts as "reset override". It also
        // lets users heal legacy stale lead_tier values (set by the old recompute
        // path) by simply clicking the tier their score now lands in.
        profile.setLeadTier(requested.equalsIgnoreCase(scoreDerived) ? null : requested);
        profile.setUpdatedAt(new Timestamp(System.currentTimeMillis()));

        UserLeadProfile saved = userLeadProfileRepository.save(profile);
        emitStatusChanged(saved, "TIER", oldTier, requested);
        return saved;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Workflow trigger emission (emit-only; the workflow engine handles delivery)
    // ─────────────────────────────────────────────────────────────────────────

    /** Emit LEAD_STATUS_CHANGED for a conversion-status or tier change on a user's lead profile. */
    private void emitStatusChanged(UserLeadProfile profile, String changeType, String oldStatus, String newStatus) {
        if (profile == null || Objects.equals(oldStatus, newStatus)) return;
        Map<String, Object> ctx = leadTriggerContextBuilder.forUser(
                profile.getInstituteId(), profile.getUserId(),
                profile.getAssignedCounselorId(), profile.getAssignedCounselorName());
        leadTriggerContextBuilder.put(ctx, "changeType", changeType);
        leadTriggerContextBuilder.put(ctx, "oldStatus", oldStatus);
        leadTriggerContextBuilder.put(ctx, "newStatus", newStatus);
        enrichWithLeadContact(ctx, profile.getUserId());
        safeEmit(WorkflowTriggerEvent.LEAD_STATUS_CHANGED.name(), profile.getUserId(),
                profile.getInstituteId(), ctx);
    }

    /** Fire a workflow trigger, never letting an automation failure break the lead operation. */
    private void safeEmit(String eventName, String eventId, String instituteId, Map<String, Object> ctx) {
        if (instituteId == null || instituteId.isBlank()) return;
        try {
            workflowTriggerService.handleTriggerEvents(eventName, eventId, instituteId, ctx);
        } catch (Exception ex) {
            log.warn("[LeadTrigger] Failed to emit {} for eventId={}: {}", eventName, eventId, ex.getMessage());
        }
    }

    /**
     * Add the lead's parent contact + pool to a user-grain ctx so communication workflows
     * (SEND_EMAIL / SEND_WHATSAPP) have a recipient — the same fields AUDIENCE_LEAD_SUBMISSION
     * and the TAT scheduler already carry. Sourced from the user's audience_response (prefers
     * one that actually has a contact). Best-effort; never breaks the emit.
     */
    private void enrichWithLeadContact(Map<String, Object> ctx, String userId) {
        if (userId == null || userId.isBlank()) return;
        try {
            // user_lead_profile.user_id can be either the parent or the student (it's the auth
            // user id of whoever the lead is keyed on). audience_response carries them in two
            // separate columns (user_id = parent, student_user_id = student) — query both so
            // we resolve the lead's audience whether this user is the parent OR the student.
            // Without this, student-grain leads silently miss enrichment and the pool-scoped
            // trigger never matches because ctx['poolId'] isn't set.
            List<AudienceResponse> responses =
                    audienceResponseRepository.findByUserIdOrStudentUserId(userId, userId);
            if (responses == null || responses.isEmpty()) {
                // No audience response — still try auth-service so {{parentName}} / {{parentEmail}}
                // resolve to the user's own record (typical for admin-created leads).
                fallbackParentFromAuthService(ctx, userId);
                return;
            }
            // Merge best-available values across all of the user's responses, so a row with a
            // null parent_email doesn't shadow a sibling row that has one. This is what makes
            // {{parentName}} / {{parentEmail}} / {{parentMobile}} resolve in production for
            // leads whose first audience_response wasn't fully populated.
            String parentName = null, parentEmail = null, parentMobile = null;
            String audienceId = null, enquiryId = null, studentUserId = null;
            for (AudienceResponse r : responses) {
                if (parentName == null && r.getParentName() != null && !r.getParentName().isBlank())
                    parentName = r.getParentName();
                if (parentEmail == null && r.getParentEmail() != null && !r.getParentEmail().isBlank())
                    parentEmail = r.getParentEmail();
                if (parentMobile == null && r.getParentMobile() != null && !r.getParentMobile().isBlank())
                    parentMobile = r.getParentMobile();
                if (audienceId == null && r.getAudienceId() != null) audienceId = r.getAudienceId();
                if (enquiryId == null && r.getEnquiryId() != null) enquiryId = r.getEnquiryId();
                if (studentUserId == null && r.getStudentUserId() != null) studentUserId = r.getStudentUserId();
            }
            leadTriggerContextBuilder.put(ctx, "parentName", parentName);
            leadTriggerContextBuilder.put(ctx, "parentEmail", parentEmail);
            leadTriggerContextBuilder.put(ctx, "parentMobile", parentMobile);
            // Cleaner lead-* aliases — for the lead list the lead IS the user, so {{leadName}}
            // reads more naturally than {{parentName}}. Both keys carry the same value.
            leadTriggerContextBuilder.put(ctx, "leadName", parentName);
            leadTriggerContextBuilder.put(ctx, "leadEmail", parentEmail);
            leadTriggerContextBuilder.put(ctx, "leadMobile", parentMobile);
            leadTriggerContextBuilder.put(ctx, "audienceId", audienceId);
            leadTriggerContextBuilder.put(ctx, "enquiryId", enquiryId);
            leadTriggerContextBuilder.put(ctx, "studentUserId", studentUserId);
            leadTriggerContextBuilder.put(ctx, "poolId",
                    leadTriggerContextBuilder.resolvePoolId(audienceId));

            // Look up the campaign name from audience so {{campaignName}} substitutes.
            if (audienceId != null) {
                try {
                    audienceRepository.findById(audienceId).ifPresent(a ->
                            leadTriggerContextBuilder.put(ctx, "campaignName", a.getCampaignName()));
                } catch (Exception ignored) { /* best-effort */ }
            }

            // For any parent_* still missing on the audience_response snapshot, try the live
            // auth-service user record — for admin-created / direct-student leads that's where
            // the name + email + mobile actually live.
            if (parentName == null || parentEmail == null || parentMobile == null) {
                fallbackParentFromAuthService(ctx, userId);
            }
        } catch (Exception e) {
            log.warn("[LeadTrigger] Failed to enrich lead contact for user {}: {}", userId, e.getMessage());
        }
    }

    /**
     * Resolve the lead user's own name/email/mobile from auth-service and fill any
     * parent_* fields the audience_response didn't have. Best-effort; the put() helper
     * is null-safe and won't overwrite values already set.
     */
    private void fallbackParentFromAuthService(Map<String, Object> ctx, String userId) {
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(userId));
            if (users == null || users.isEmpty()) return;
            UserDTO u = users.get(0);
            if (!ctx.containsKey("parentName") && u.getFullName() != null && !u.getFullName().isBlank()) {
                leadTriggerContextBuilder.put(ctx, "parentName", u.getFullName());
                leadTriggerContextBuilder.put(ctx, "leadName", u.getFullName());
            }
            if (!ctx.containsKey("parentEmail") && u.getEmail() != null && !u.getEmail().isBlank()) {
                leadTriggerContextBuilder.put(ctx, "parentEmail", u.getEmail());
                leadTriggerContextBuilder.put(ctx, "leadEmail", u.getEmail());
            }
            if (!ctx.containsKey("parentMobile") && u.getMobileNumber() != null && !u.getMobileNumber().isBlank()) {
                leadTriggerContextBuilder.put(ctx, "parentMobile", u.getMobileNumber());
                leadTriggerContextBuilder.put(ctx, "leadMobile", u.getMobileNumber());
            }
        } catch (Exception e) {
            log.debug("[LeadTrigger] auth-service fallback failed for user {}: {}", userId, e.getMessage());
        }
    }

    /**
     * Rebuild the profile for a user given only their userId.
     * Looks up the institute from the existing profile (user_id is unique on user_lead_profile,
     * so there is at most one). Used by event-driven triggers like timeline event inserts
     * where the caller doesn't have the institute in hand.
     *
     * For every audience response the user owns, re-runs the full scoring formula so
     * that newly-added timeline events flow into the engagement component. Without
     * this, buildOrUpdateProfile would just re-aggregate the existing (stale)
     * LeadScore.rawScore values and best_score would never move.
     *
     * Best-effort — no-op if no profile exists yet (the user has never been scored).
     */
    @Transactional
    public void recomputeForUser(String userId) {
        if (userId == null) return;
        UserLeadProfile profile = userLeadProfileRepository.findByUserId(userId).orElse(null);
        if (profile == null) return;

        String instituteId = profile.getInstituteId();

        List<AudienceResponse> responses =
                audienceResponseRepository.findByUserIdOrStudentUserId(userId, userId);

        boolean anyRecalculated = false;
        for (AudienceResponse r : responses) {
            try {
                leadScoringService.recalculateScore(r.getId());
                anyRecalculated = true;
            } catch (Exception e) {
                log.warn("Failed to recalculate LeadScore for response {} during user recompute",
                        r.getId(), e);
            }
        }

        // recalculateScore() ends with a buildOrUpdateProfile call (via calculateAndSaveScore),
        // so when responses exist the profile is already up to date. If the user has no
        // responses (e.g. captured outside the campaign flow), still update the profile
        // directly so total_timeline_events reflects the new event.
        if (!anyRecalculated) {
            buildOrUpdateProfile(userId, instituteId);
        }
    }

    /**
     * Fetch the lead profile DTO for a single user.
     */
    public Optional<UserLeadProfileDTO> getProfileDTO(String userId, String instituteId) {
        return userLeadProfileRepository
                .findByUserIdAndInstituteId(userId, instituteId)
                .map(this::toDTO);
    }

    /**
     * Batch fetch profiles for a list of user IDs (used by manage-students and manage-contacts).
     */
    public Map<String, UserLeadProfileDTO> getProfilesForUsers(List<String> userIds) {
        if (userIds == null || userIds.isEmpty()) return Collections.emptyMap();
        return userLeadProfileRepository.findByUserIdIn(userIds).stream()
                .collect(Collectors.toMap(
                        UserLeadProfile::getUserId,
                        this::toDTO
                ));
    }

    /**
     * Get all audience/campaign memberships for a user.
     * Returns one entry per audience response the user has submitted.
     */
    public List<UserAudienceMembershipDTO> getUserAudienceMemberships(String userId) {
        List<AudienceResponse> responses = audienceResponseRepository.findByUserIdOrStudentUserId(userId, userId);
        if (responses.isEmpty()) return Collections.emptyList();

        // Batch fetch audience details
        Set<String> audienceIds = responses.stream()
                .map(AudienceResponse::getAudienceId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, Audience> audienceMap = audienceRepository.findAllById(audienceIds).stream()
                .collect(Collectors.toMap(Audience::getId, a -> a, (a, b) -> a));

        // Batch fetch lead scores
        List<String> responseIds = responses.stream().map(AudienceResponse::getId).collect(Collectors.toList());
        Map<String, LeadScore> scoreMap = leadScoreRepository.findByAudienceResponseIdIn(responseIds).stream()
                .collect(Collectors.toMap(LeadScore::getAudienceResponseId, s -> s, (a, b) -> a));

        return responses.stream().map(r -> {
            Audience aud = audienceMap.get(r.getAudienceId());
            LeadScore score = scoreMap.get(r.getId());
            return UserAudienceMembershipDTO.builder()
                    .audienceId(r.getAudienceId())
                    .campaignName(aud != null ? aud.getCampaignName() : null)
                    .campaignStatus(aud != null ? aud.getStatus() : null)
                    .responseId(r.getId())
                    .overallStatus(r.getOverallStatus())
                    .sourceType(r.getSourceType())
                    .submittedAt(r.getSubmittedAt())
                    .leadScore(score != null ? score.getRawScore() : null)
                    .build();
        }).collect(Collectors.toList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Batch Scheduler
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Batch rebuild all profiles every 30 minutes.
     * Catches up with any changes missed by real-time updates (e.g. percentile recalcs).
     */
    @Scheduled(fixedRate = 30 * 60 * 1000)
    public void batchRebuildProfiles() {
        log.info("Starting batch user_lead_profile rebuild...");

        // Get all distinct (userId, instituteId) pairs from lead_score via audience_response
        List<LeadScore> allScores = leadScoreRepository.findAll();
        if (allScores.isEmpty()) return;

        // Group score IDs by instituteId
        Map<String, List<String>> byInstitute = allScores.stream()
                .collect(Collectors.groupingBy(
                        LeadScore::getInstituteId,
                        Collectors.mapping(LeadScore::getAudienceResponseId, Collectors.toList())
                ));

        int total = 0;
        for (Map.Entry<String, List<String>> entry : byInstitute.entrySet()) {
            String instituteId = entry.getKey();
            List<String> responseIds = entry.getValue();

            // Fetch responses by ID to get userIds
            Set<String> userIds = new HashSet<>();
            for (String responseId : responseIds) {
                audienceResponseRepository.findById(responseId).ifPresent(r -> {
                    if (r.getUserId() != null) userIds.add(r.getUserId());
                    if (r.getStudentUserId() != null) userIds.add(r.getStudentUserId());
                });
            }

            for (String userId : userIds) {
                try {
                    buildOrUpdateProfile(userId, instituteId);
                    total++;
                } catch (Exception e) {
                    log.error("Batch rebuild failed for userId={}, instituteId={}", userId, instituteId, e);
                }
            }
        }

        log.info("Batch user_lead_profile rebuild complete. Updated {} profiles.", total);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private void updateScoreFields(
            UserLeadProfile profile,
            List<LeadScore> scores,
            List<AudienceResponse> allResponses) {

        if (scores.isEmpty()) {
            profile.setBestScore(0);
            // Don't write lead_tier here. If an admin has explicitly set it (e.g. HOT
            // for a known interested lead with no submissions yet), recompute should
            // preserve that override. Frontend infers a tier from best_score when
            // lead_tier is null.
            profile.setCampaignCount(0);
            return;
        }

        // Best score
        LeadScore best = scores.stream()
                .max(Comparator.comparingInt(LeadScore::getRawScore))
                .orElse(null);

        if (best != null) {
            profile.setBestScore(best.getRawScore());
            profile.setBestScoreResponseId(best.getAudienceResponseId());
            // Do NOT setLeadTier here — keeping the explicit override (or null) lets the
            // frontend treat "lead_tier present" as a manual override and fall back to
            // best_score-derived tier when it's null. Previously every recompute would
            // overwrite a manual HOT/WARM/COLD click within seconds.

            // Find source type of best response
            allResponses.stream()
                    .filter(r -> r.getId().equals(best.getAudienceResponseId()))
                    .findFirst()
                    .ifPresent(r -> profile.setBestSourceType(r.getSourceType()));
        }

        // Campaign count = distinct audienceIds across scores
        long campaignCount = scores.stream()
                .map(LeadScore::getAudienceId)
                .distinct()
                .count();
        profile.setCampaignCount((int) campaignCount);

        // Last activity = most recent response submission
        allResponses.stream()
                .map(AudienceResponse::getSubmittedAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .ifPresent(profile::setLastActivityAt);
    }

    private void updateActivityCounts(
            UserLeadProfile profile,
            String userId,
            List<LeadScore> scores) {

        // Timeline events for this user. Two sources contribute:
        //  1. Cross-stage events (notes, calls, meetings, follow-ups) logged from the
        //     lead-profile drawer — stamped with student_user_id = userId regardless of
        //     the parent entity type (STUDENT / ENQUIRY / APPLICANT).
        //  2. Events tied directly to an audience response (type = "AUDIENCE_RESPONSE")
        //     for users with campaign submissions.
        // Cross-stage events typically don't carry a type='AUDIENCE_RESPONSE' parent,
        // so summing the two counts is safe in practice. If a future emitter sets both
        // student_user_id AND attaches to an audience response, switch to a DISTINCT query.
        try {
            long crossStageCount = timelineEventRepository.countByStudentUserId(userId);

            long responseCount = 0;
            List<String> responseIds = scores.stream()
                    .map(LeadScore::getAudienceResponseId)
                    .collect(Collectors.toList());
            if (!responseIds.isEmpty()) {
                responseCount = timelineEventRepository
                        .countByTypeAndTypeIdIn("AUDIENCE_RESPONSE", responseIds);
            }

            profile.setTotalTimelineEvents((int) (crossStageCount + responseCount));
        } catch (Exception e) {
            log.warn("Failed to count timeline events for userId={}", userId, e);
        }

        // Demo attendance count (ATTENDANCE_RECORDED logs where userSourceId = userId)
        try {
            long attendanceCount = liveSessionLogsRepository
                    .countByUserSourceIdAndLogType(userId, "ATTENDANCE_RECORDED");
            profile.setDemoAttendanceCount((int) attendanceCount);
        } catch (Exception e) {
            log.warn("Failed to count demo attendance for userId={}", userId, e);
        }
    }

    /**
     * Assign a counselor to a user's lead profile (stored at profile level, not per-response).
     *
     * @param userId       Auth user ID of the lead
     * @param instituteId  Institute ID
     * @param counselorId  Auth user ID of the counselor being assigned
     * @param counselorName Display name of the counselor (pass null to clear)
     */
    @Transactional
    public UserLeadProfile assignCounselor(String userId, String instituteId, String counselorId, String counselorName) {
        UserLeadProfile profile = userLeadProfileRepository
                .findByUserIdAndInstituteId(userId, instituteId)
                .orElseGet(() -> UserLeadProfile.builder()
                        .userId(userId)
                        .instituteId(instituteId)
                        .build());

        profile.setAssignedCounselorId(counselorId);
        profile.setAssignedCounselorName(counselorName);
        profile.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
        UserLeadProfile saved = userLeadProfileRepository.save(profile);

        // Emit workflow trigger only on actual assignment (not on clear).
        // Journey event logging (COUNSELOR_ASSIGNED) is done by the caller (AudienceController)
        // to keep TimelineEventService free of circular dependencies.
        if (counselorId != null && !counselorId.isBlank()) {
            Map<String, Object> ctx = leadTriggerContextBuilder.forUser(
                    instituteId, userId, counselorId, counselorName);
            enrichWithLeadContact(ctx, userId);
            safeEmit(WorkflowTriggerEvent.LEAD_ASSIGNED_TO_COUNSELOR.name(), userId, instituteId, ctx);
        }
        return saved;
    }

    private UserLeadProfileDTO toDTO(UserLeadProfile p) {
        return UserLeadProfileDTO.builder()
                .userId(p.getUserId())
                .instituteId(p.getInstituteId())
                .bestScore(p.getBestScore())
                .bestScoreResponseId(p.getBestScoreResponseId())
                .leadTier(p.getLeadTier())
                .conversionStatus(p.getConversionStatus())
                .convertedAt(p.getConvertedAt())
                .campaignCount(p.getCampaignCount())
                .bestSourceType(p.getBestSourceType())
                .totalTimelineEvents(p.getTotalTimelineEvents())
                .demoLoginCount(p.getDemoLoginCount())
                .demoAttendanceCount(p.getDemoAttendanceCount())
                .lastActivityAt(p.getLastActivityAt())
                .lastCalculatedAt(p.getLastCalculatedAt())
                .createdAt(p.getCreatedAt())
                .assignedCounselorId(p.getAssignedCounselorId())
                .assignedCounselorName(p.getAssignedCounselorName())
                .build();
    }
}
