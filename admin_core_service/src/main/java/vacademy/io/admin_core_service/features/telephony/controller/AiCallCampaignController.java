package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.telephony.core.AiCallCampaignService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Bulk "AI calls first" for an audience list. Authenticated admin/counsellor
 * action. Returns immediately after validating + counting; the per-lead calls are
 * placed on a paced background pool, and each lead's outcome → counsellor
 * assignment is handled asynchronously by the end-of-call webhook +
 * AiCallOutcomeProcessor.
 *
 *   POST /admin-core-service/v1/telephony/ai-call/campaign/{audienceId}?instituteId=
 *   → { total, eligible, dispatched, message }
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/ai-call/campaign")
@RequiredArgsConstructor
public class AiCallCampaignController {

    private final AiCallCampaignService campaignService;

    @PostMapping("/{audienceId}")
    public ResponseEntity<AiCallCampaignService.StartResult> start(
            @PathVariable String audienceId,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(campaignService.startForAudience(instituteId, audienceId));
    }
}
