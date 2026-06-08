package vacademy.io.admin_core_service.features.counsellor_rating.controller;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.counsellor_rating.dto.LeaderboardEntryDTO;
import vacademy.io.admin_core_service.features.counsellor_rating.dto.RatingDTO;
import vacademy.io.admin_core_service.features.counsellor_rating.service.CounsellorRatingService;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Read + manual-override endpoints for counsellor ratings. Strategy config
 * (window, weights, thresholds) is owned by /counsellor-workbench/config —
 * everything that's not a per-counsellor score lives in institute_setting JSON.
 */
@RestController
@RequestMapping("/admin-core-service/v1/counsellor-rating")
@RequiredArgsConstructor
public class CounsellorRatingController {

    private final CounsellorRatingService service;

    @GetMapping
    public ResponseEntity<RatingDTO> getOne(
            @RequestParam("instituteId") String instituteId,
            @RequestParam("counsellor_user_id") String counsellorUserId) {
        return ResponseEntity.ok(service.getRating(instituteId, counsellorUserId));
    }

    @PostMapping("/batch")
    public ResponseEntity<Map<String, RatingDTO>> batch(@RequestBody BatchRequest request) {
        return ResponseEntity.ok(service.getRatingsBatch(request.getInstituteId(), request.getCounsellorUserIds()));
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<List<LeaderboardEntryDTO>> leaderboard(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "team_id", required = false) String teamId,
            @RequestParam(value = "limit", defaultValue = "10") int limit) {
        return ResponseEntity.ok(service.leaderboard(instituteId, teamId, limit));
    }

    @PutMapping("/{counsellorUserId}/manual")
    public ResponseEntity<RatingDTO> manualOverride(
            @PathVariable String counsellorUserId,
            @RequestBody ManualRequest request) {
        return ResponseEntity.ok(service.setManualOverride(request.getInstituteId(), counsellorUserId, request.getScore()));
    }

    @PostMapping("/recompute")
    public ResponseEntity<RecomputeResponse> recompute(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "counsellor_user_id", required = false) String counsellorUserId) {
        if (counsellorUserId != null && !counsellorUserId.isBlank()) {
            RatingDTO r = service.recomputeOne(instituteId, counsellorUserId);
            return ResponseEntity.ok(new RecomputeResponse(1, r));
        }
        int n = service.recomputeAll(instituteId);
        return ResponseEntity.ok(new RecomputeResponse(n, null));
    }

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class BatchRequest {
        private String instituteId;
        private List<String> counsellorUserIds;
    }

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ManualRequest {
        private String instituteId;
        private BigDecimal score;
    }

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class RecomputeResponse {
        private int affected;
        private RatingDTO rating;

        public RecomputeResponse(int affected, RatingDTO rating) {
            this.affected = affected;
            this.rating = rating;
        }
    }
}
