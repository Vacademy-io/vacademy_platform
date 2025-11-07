package vacademy.io.admin_core_service.features.user_subscription.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralOptionService;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/referral-option")
public class ReferralOptionController {

    private final ReferralOptionService referralOptionService;

    public ReferralOptionController(ReferralOptionService referralOptionService) {
        this.referralOptionService = referralOptionService;
    }

    @PostMapping
    public ResponseEntity<String> addReferralOption(@RequestBody ReferralOptionDTO referralOption) {
        return ResponseEntity.ok(referralOptionService.addReferralOption(referralOption));
    }

    @DeleteMapping
    public ResponseEntity<String> deleteReferralOptions(@RequestBody List<String> referralOptionIds) {
        return ResponseEntity.ok(referralOptionService.deleteReferralOptions(referralOptionIds));
    }

    @GetMapping
    public ResponseEntity<List<ReferralOptionDTO>> getAllReferralOptions(@RequestParam String source,
            @RequestParam String sourceId) {
        return ResponseEntity.ok(referralOptionService.getReferralOptions(source, sourceId));
    }

    @PutMapping("/{referralOptionId}")
    public ResponseEntity<String> updateReferralOption(@PathVariable String referralOptionId,
            @RequestBody ReferralOptionDTO referralOption) {
        return ResponseEntity.ok(referralOptionService.updateReferralOption(referralOptionId, referralOption));
    }
}
