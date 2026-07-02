package vacademy.io.admin_core_service.features.leaderboard.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.leaderboard.dto.BadgeStatsResponseDTO;
import vacademy.io.admin_core_service.features.leaderboard.dto.LeaderboardResponseDTO;
import vacademy.io.admin_core_service.features.leaderboard.dto.LearnerSummaryDTO;
import vacademy.io.admin_core_service.features.leaderboard.service.LeaderboardService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/leaderboard/v1")
@RequiredArgsConstructor
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    /** Learner-facing course leaderboard: anonymized (initials), the caller's own row marked "You". */
    @GetMapping("/course/me")
    public ResponseEntity<LeaderboardResponseDTO> getCourseLeaderboardForLearner(
            @RequestParam String packageSessionId,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(leaderboardService.buildCourseLeaderboard(
                packageSessionId, instituteId, user.getUserId(), true, 50, user));
    }

    /** Admin course leaderboard: real names, full list. */
    @GetMapping("/course/admin")
    public ResponseEntity<LeaderboardResponseDTO> getCourseLeaderboardForAdmin(
            @RequestParam String packageSessionId,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(leaderboardService.buildCourseLeaderboard(
                packageSessionId, instituteId, null, false, 200, user));
    }

    /** The learner's own profile summary: total badges, badge list, and best course rank. */
    @GetMapping("/my-summary")
    public ResponseEntity<LearnerSummaryDTO> getMySummary(
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(leaderboardService.buildLearnerSummary(instituteId, user.getUserId(), user));
    }

    /** Institute-wide badge award stats for the admin badges overview. */
    @GetMapping("/badge-stats")
    public ResponseEntity<BadgeStatsResponseDTO> getBadgeStats(
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(leaderboardService.buildBadgeStats(instituteId));
    }
}
