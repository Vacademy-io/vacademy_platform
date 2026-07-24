package vacademy.io.admin_core_service.features.learner_badge.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.learner_badge.dto.AwardBadgeRequest;
import vacademy.io.admin_core_service.features.learner_badge.dto.LearnerBadgeDTO;
import vacademy.io.admin_core_service.features.learner_badge.dto.SyncUnlocksRequest;
import vacademy.io.admin_core_service.features.learner_badge.entity.LearnerBadge;
import vacademy.io.admin_core_service.features.learner_badge.entity.LearnerBadgeStatus;
import vacademy.io.admin_core_service.features.learner_badge.repository.LearnerBadgeRepository;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class LearnerBadgeService {

    private final LearnerBadgeRepository learnerBadgeRepository;
    private final NotificationService notificationService;

    /**
     * Award a configured badge to one or more learners. Idempotent: a learner who
     * already has an active award for the same badge is skipped. Fires a best-effort
     * notification per newly-awarded learner.
     */
    @Transactional
    public List<LearnerBadgeDTO> award(AwardBadgeRequest request, String instituteId,
                                       String awardedByUserId, String awardedByName) {
        List<LearnerBadgeDTO> awarded = new ArrayList<>();

        for (String userId : request.getUserIds()) {
            if (userId == null || userId.isBlank()) continue;

            Optional<LearnerBadge> existing =
                    learnerBadgeRepository.findActiveAward(userId, request.getBadgeId(), instituteId);
            if (existing.isPresent()) {
                // Already holds an active award for this badge — keep it idempotent.
                awarded.add(LearnerBadgeDTO.fromEntity(existing.get()));
                continue;
            }

            LearnerBadge badge = new LearnerBadge();
            badge.setUserId(userId);
            badge.setInstituteId(instituteId);
            badge.setBadgeId(request.getBadgeId());
            badge.setBadgeName(request.getBadgeName());
            badge.setBadgeIcon(request.getBadgeIcon());
            badge.setBadgeDescription(request.getBadgeDescription());
            badge.setReason(request.getReason());
            badge.setSource("MANUAL");
            badge.setStatus(LearnerBadgeStatus.ACTIVE);
            badge.setAwardedByUserId(awardedByUserId);
            badge.setAwardedAt(new Timestamp(System.currentTimeMillis()));

            LearnerBadge saved = learnerBadgeRepository.save(badge);
            awarded.add(LearnerBadgeDTO.fromEntity(saved));

            notifyAwarded(instituteId, userId, saved, awardedByUserId, awardedByName);
        }

        return awarded;
    }

    /**
     * Persist a learner's client-computed auto-unlock badges (source = AUTO) so they show
     * on the in-app and public leaderboards, which read {@code learner_badge}. The learner
     * is taken from the JWT by the caller — never from the request body.
     *
     * Idempotent and non-destructive: a badge is inserted only when NO row exists for that
     * (user, badge, institute). That skips badges already synced, admin-awarded (MANUAL),
     * or explicitly revoked by an admin — so sync never resurrects a revoked badge, never
     * duplicates, and never overwrites a manual award. Auto badges are not revoked here
     * (a badge, once earned, stays earned even if the trigger later lapses). No
     * notification is sent — the learner already saw the unlock in their own app.
     *
     * Deliberately NOT {@code @Transactional}: each badge insert must commit independently
     * so that a rare concurrent same-user race (two dashboard loads inserting the same
     * badge) surfaces the unique-index violation synchronously per {@code save()} — where
     * the catch below can absorb it — instead of poisoning one shared transaction and
     * rolling back the whole batch at commit. The inserts are independent, so no atomicity
     * is lost.
     *
     * @return the number of newly-persisted badges.
     */
    public int syncAutoUnlocks(String userId, String instituteId,
                               List<SyncUnlocksRequest.UnlockedBadge> badges) {
        if (userId == null || userId.isBlank() || instituteId == null || badges == null) return 0;

        int inserted = 0;
        for (SyncUnlocksRequest.UnlockedBadge b : badges) {
            if (b == null || b.getBadgeId() == null || b.getBadgeId().isBlank()) continue;
            if (learnerBadgeRepository.existsByUserIdAndBadgeIdAndInstituteId(
                    userId, b.getBadgeId(), instituteId)) {
                continue;
            }

            LearnerBadge badge = new LearnerBadge();
            badge.setUserId(userId);
            badge.setInstituteId(instituteId);
            badge.setBadgeId(b.getBadgeId());
            badge.setBadgeName(b.getBadgeName());
            badge.setBadgeIcon(b.getBadgeIcon());
            badge.setBadgeDescription(b.getBadgeDescription());
            badge.setSource("AUTO");
            badge.setStatus(LearnerBadgeStatus.ACTIVE);
            badge.setAwardedAt(new Timestamp(System.currentTimeMillis()));

            try {
                learnerBadgeRepository.save(badge);
                inserted++;
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                // A concurrent sync/award inserted the same badge first — the partial
                // unique index rejected the duplicate. Safe to ignore (idempotent).
                log.debug("Auto-unlock already present for user {} badge {}", userId, b.getBadgeId());
            }
        }
        return inserted;
    }

    /**
     * Revoke a learner's active award for a badge (keeps the row, flips status to REVOKED).
     */
    @Transactional
    public boolean revoke(String userId, String badgeId, String instituteId, String revokedByUserId) {
        Optional<LearnerBadge> existing =
                learnerBadgeRepository.findActiveAward(userId, badgeId, instituteId);
        if (existing.isEmpty()) return false;

        LearnerBadge badge = existing.get();
        badge.setStatus(LearnerBadgeStatus.REVOKED);
        badge.setRevokedByUserId(revokedByUserId);
        badge.setRevokedAt(new Timestamp(System.currentTimeMillis()));
        learnerBadgeRepository.save(badge);
        return true;
    }

    /** Active awarded badges for a learner (used by both the admin student view and the learner app). */
    public List<LearnerBadgeDTO> getActiveAwardsForUser(String userId, String instituteId) {
        return learnerBadgeRepository
                .findByUserIdAndInstituteIdAndStatus(userId, instituteId, LearnerBadgeStatus.ACTIVE)
                .stream()
                .map(LearnerBadgeDTO::fromEntity)
                .collect(Collectors.toList());
    }

    private void notifyAwarded(String instituteId, String learnerId, LearnerBadge badge,
                               String awardedByUserId, String awardedByName) {
        try {
            String badgeName = badge.getBadgeName() != null ? badge.getBadgeName() : "a badge";
            String title = "You earned a badge!";
            String body = "Your institute awarded you the \"" + badgeName + "\" badge"
                    + (badge.getReason() != null && !badge.getReason().isBlank()
                        ? " — " + badge.getReason() : ".");

            Map<String, Object> alertSettings = new HashMap<>();
            alertSettings.put("priority", 2);
            alertSettings.put("isDismissible", true);
            alertSettings.put("showBadge", true);
            alertSettings.put("isActive", true);

            notificationService.createSystemAlertAnnouncement(
                    instituteId,
                    List.of(learnerId),
                    title,
                    body,
                    awardedByUserId != null ? awardedByUserId : "system",
                    awardedByName != null ? awardedByName : "Admin",
                    "ADMIN",
                    alertSettings);

            Map<String, String> pushData = new HashMap<>();
            pushData.put("badgeId", badge.getBadgeId());
            pushData.put("badgeName", badgeName);
            pushData.put("source", "BADGE_AWARD");

            notificationService.sendPushViaUnified(instituteId, List.of(learnerId), title, body, pushData);
        } catch (Exception e) {
            // Best-effort: the award is already persisted; never fail the award on notification error.
            log.warn("Failed to send badge-award notification to learner {}: {}", learnerId, e.getMessage());
        }
    }
}
