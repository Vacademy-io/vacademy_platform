package vacademy.io.admin_core_service.features.engagement.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementPlanDTO;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementPlanRequest;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementSlotDTO;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementSlotRequest;
import vacademy.io.admin_core_service.features.engagement.service.EngagementPlanService;
import vacademy.io.admin_core_service.features.engagement.service.EngagementTrackingService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Teacher/admin authoring and tracking for daily engagement.
 *
 * <p>Every endpoint proves staff membership of the institute it names. Without that
 * check the instituteId is just a string the caller supplies, so any authenticated
 * user — including a learner — could publish content straight onto another
 * institute's learner home pages, or read their plans back.
 */
@RestController
@RequestMapping("/admin-core-service/engagement/admin/v1")
@RequiredArgsConstructor
@Slf4j
public class EngagementAdminController {

    private final EngagementPlanService planService;
    private final EngagementTrackingService trackingService;
    private final InstituteAccessValidator instituteAccessValidator;

    /**
     * Create the plan for one batch, or for several at once via packageSessionIds.
     * Returns the list either way, so a caller never has to branch on which field it sent.
     */
    @PostMapping("/plan")
    public ResponseEntity<List<EngagementPlanDTO>> createPlan(
            @RequestParam String instituteId,
            @RequestBody EngagementPlanRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireStaffAccess(user, instituteId);
        return ResponseEntity.ok(planService.createPlans(request, instituteId, user.getUserId()));
    }

    @PutMapping("/plan/{planId}")
    public ResponseEntity<EngagementPlanDTO> updatePlan(
            @PathVariable String planId,
            @RequestParam String instituteId,
            @RequestBody EngagementPlanRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireStaffAccess(user, instituteId);
        return ResponseEntity.ok(planService.updatePlan(planId, request, instituteId));
    }

    @GetMapping("/plan/{planId}")
    public ResponseEntity<EngagementPlanDTO> getPlan(
            @PathVariable String planId,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireStaffAccess(user, instituteId);
        return ResponseEntity.ok(planService.getPlan(planId, instituteId));
    }

    @GetMapping("/plan/list")
    public ResponseEntity<List<EngagementPlanDTO>> listPlans(
            @RequestParam String instituteId,
            @RequestParam(required = false) String packageSessionId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireStaffAccess(user, instituteId);
        return ResponseEntity.ok(planService.listPlans(instituteId, packageSessionId));
    }

    @DeleteMapping("/plan/{planId}")
    public ResponseEntity<Map<String, Boolean>> deletePlan(
            @PathVariable String planId,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireStaffAccess(user, instituteId);
        planService.deletePlan(planId, instituteId);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    @PostMapping("/plan/{planId}/slot")
    public ResponseEntity<EngagementSlotDTO> upsertSlot(
            @PathVariable String planId,
            @RequestParam String instituteId,
            @RequestBody EngagementSlotRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireStaffAccess(user, instituteId);
        return ResponseEntity.ok(planService.upsertSlot(planId, request, instituteId));
    }

    @DeleteMapping("/slot/{slotId}")
    public ResponseEntity<Map<String, Boolean>> deleteSlot(
            @PathVariable String slotId,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireStaffAccess(user, instituteId);
        planService.deleteSlot(slotId, instituteId);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    /** Per-learner attempt table plus aggregates for one item. */
    @GetMapping("/item/{itemId}/tracking")
    public ResponseEntity<?> itemTracking(
            @PathVariable String itemId,
            @RequestParam String instituteId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireStaffAccess(user, instituteId);
        return ResponseEntity.ok(trackingService.getItemTracking(itemId, instituteId, page, size));
    }

    /**
     * The same table as CSV — every attempt, not just the page on screen.
     *
     * Returned as a download so a teacher gets a file rather than a wall of text, and
     * built server-side so the export is the full result set.
     */
    @GetMapping("/item/{itemId}/tracking/export")
    public ResponseEntity<byte[]> exportItemTracking(
            @PathVariable String itemId,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireStaffAccess(user, instituteId);
        byte[] csv = trackingService.exportItemCsv(itemId, instituteId)
                .getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, "text/csv; charset=UTF-8")
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"engagement-" + itemId + ".csv\"")
                .body(csv);
    }
}
