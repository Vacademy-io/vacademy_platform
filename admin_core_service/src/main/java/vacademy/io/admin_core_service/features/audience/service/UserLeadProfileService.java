package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionLogsRepository;
import vacademy.io.admin_core_service.features.timeline.repository.TimelineEventRepository;

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

        profile.setConversionStatus("CONVERTED");
        profile.setConvertedAt(new Timestamp(System.currentTimeMillis()));
        profile.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
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

        profile.setConversionStatus(status);
        profile.setUpdatedAt(new Timestamp(System.currentTimeMillis()));

        if ("CONVERTED".equals(status)) {
            profile.setConvertedAt(new Timestamp(System.currentTimeMillis()));
        } else {
            profile.setConvertedAt(null);
        }

        return userLeadProfileRepository.save(profile);
    }

    /**
     * Manually set the lead tier (HOT, WARM, COLD) by overriding the best_score.
     * HOT → score 90, WARM → score 60, COLD → score 20.
     */
    @Transactional
    public UserLeadProfile updateLeadTier(String userId, String instituteId, String tier) {
        UserLeadProfile profile = userLeadProfileRepository
                .findByUserIdAndInstituteId(userId, instituteId)
                .orElseGet(() -> UserLeadProfile.builder()
                        .userId(userId)
                        .instituteId(instituteId)
                        .build());

        int score;
        switch (tier.toUpperCase()) {
            case "HOT":  score = 90; break;
            case "WARM": score = 60; break;
            default:     score = 20; break;
        }
        profile.setBestScore(score);
        profile.setLeadTier(tier.toUpperCase());
        profile.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
        profile.setLastCalculatedAt(new Timestamp(System.currentTimeMillis()));

        return userLeadProfileRepository.save(profile);
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
            profile.setLeadTier("COLD");
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
            profile.setLeadTier(profile.computeTier());

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

        // Timeline events across all audience responses (type = "AUDIENCE_RESPONSE")
        List<String> responseIds = scores.stream()
                .map(LeadScore::getAudienceResponseId)
                .collect(Collectors.toList());

        if (!responseIds.isEmpty()) {
            try {
                long eventCount = timelineEventRepository
                        .countByTypeAndTypeIdIn("AUDIENCE_RESPONSE", responseIds);
                profile.setTotalTimelineEvents((int) eventCount);
            } catch (Exception e) {
                log.warn("Failed to count timeline events for userId={}", userId, e);
            }
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
                .build();
    }
}
