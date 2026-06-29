package vacademy.io.admin_core_service.features.learner_badge.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_badge.dto.AwardBadgeRequest;
import vacademy.io.admin_core_service.features.learner_badge.dto.LearnerBadgeDTO;
import vacademy.io.admin_core_service.features.learner_badge.service.LearnerBadgeService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/learner-badge")
@RequiredArgsConstructor
@Slf4j
public class LearnerBadgeController {

    private final LearnerBadgeService learnerBadgeService;

    /** Admin: award a configured badge to one or more learners. */
    @PostMapping("/institutes/{instituteId}/award")
    public ResponseEntity<List<LearnerBadgeDTO>> award(
            @PathVariable String instituteId,
            @Valid @RequestBody AwardBadgeRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        List<LearnerBadgeDTO> awarded =
                learnerBadgeService.award(request, instituteId, user.getUserId(), user.getFullName());
        return ResponseEntity.ok(awarded);
    }

    /** Admin: revoke a learner's active award for a badge (kept for audit, status -> REVOKED). */
    @PostMapping("/institutes/{instituteId}/revoke")
    public ResponseEntity<Map<String, Boolean>> revoke(
            @PathVariable String instituteId,
            @RequestParam String userId,
            @RequestParam String badgeId,
            @RequestAttribute("user") CustomUserDetails user) {
        boolean revoked = learnerBadgeService.revoke(userId, badgeId, instituteId, user.getUserId());
        return ResponseEntity.ok(Map.of("revoked", revoked));
    }

    /** Admin: list a learner's active awarded badges (for the student detail "Badges" tab). */
    @GetMapping("/institutes/{instituteId}/users/{userId}")
    public ResponseEntity<List<LearnerBadgeDTO>> getUserAwardedBadges(
            @PathVariable String instituteId,
            @PathVariable String userId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerBadgeService.getActiveAwardsForUser(userId, instituteId));
    }

    /** Learner: list the authenticated learner's own active awarded badges. */
    @GetMapping("/learner/v1/my-badges")
    public ResponseEntity<List<LearnerBadgeDTO>> getMyAwardedBadges(
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerBadgeService.getActiveAwardsForUser(user.getUserId(), instituteId));
    }
}
