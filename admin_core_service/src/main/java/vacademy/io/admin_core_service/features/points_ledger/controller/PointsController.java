package vacademy.io.admin_core_service.features.points_ledger.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.points_ledger.dto.PointsSummaryDTO;
import vacademy.io.admin_core_service.features.points_ledger.service.PointsLedgerService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/points")
@RequiredArgsConstructor
@Slf4j
public class PointsController {

    private final PointsLedgerService pointsLedgerService;

    /**
     * The authenticated learner's own points summary.
     *
     * The user is ALWAYS taken from the JWT, never from a parameter, so a caller
     * cannot read another learner's points by changing an id.
     */
    @GetMapping("/v1/me/summary")
    public ResponseEntity<PointsSummaryDTO> mySummary(
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(pointsLedgerService.getSummary(instituteId, user.getUserId()));
    }

    /** Admin: one learner's points summary (student detail view). */
    @GetMapping("/v1/learner/summary")
    public ResponseEntity<PointsSummaryDTO> learnerSummary(
            @RequestParam String instituteId,
            @RequestParam String userId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(pointsLedgerService.getSummary(instituteId, userId));
    }
}
