package vacademy.io.admin_core_service.features.leaderboard.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.leaderboard.dto.LeaderboardResponseDTO;
import vacademy.io.admin_core_service.features.leaderboard.service.LeaderboardService;

/**
 * Public (no-auth) course leaderboard for the shareable, white-labelled page.
 * Lives under /public/** so it bypasses JWT auth (see ApplicationSecurityConfig).
 * Returns fully-anonymized data only (initials, points, badges — no PII).
 */
@RestController
@RequestMapping("/admin-core-service/public/leaderboard/v1")
@RequiredArgsConstructor
public class PublicLeaderboardController {

    private final LeaderboardService leaderboardService;

    @GetMapping("/course/{packageSessionId}")
    public ResponseEntity<LeaderboardResponseDTO> getPublicCourseLeaderboard(
            @PathVariable String packageSessionId,
            @RequestParam String instituteId) {
        return ResponseEntity.ok(
                leaderboardService.buildPublicCourseLeaderboard(packageSessionId, instituteId));
    }
}
