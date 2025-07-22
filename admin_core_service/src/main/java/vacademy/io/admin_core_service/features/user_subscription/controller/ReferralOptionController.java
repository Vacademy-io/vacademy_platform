package vacademy.io.admin_core_service.features.user_subscription.controller;

import org.checkerframework.checker.units.qual.A;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralOptionService;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/referral-option")
public class ReferralOptionController {
    @Autowired
    private ReferralOptionService referralOptionService;

    @PostMapping
    public ResponseEntity<String>addReferralOption(@RequestBody ReferralOptionDTO referralOption){
        return ResponseEntity.ok(referralOptionService.addReferralOption(referralOption));
    }

    @DeleteMapping("/referral-option")
    public ResponseEntity<String>deleteReferralOptions(@RequestBody List<String> referralOptionIds){
        return ResponseEntity.ok(referralOptionService.deleteReferralOptions(referralOptionIds));
    }

    @GetMapping
    public ResponseEntity<List<ReferralOptionDTO>>getAllReferralOptions(String source,String sourceId){
        return ResponseEntity.ok(referralOptionService.getReferralOptions(source,sourceId));
    }
}
