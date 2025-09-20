package vacademy.io.admin_core_service.features.user_subscription.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralBenefitLogDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralDetailDTO;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralBenefitLogService;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralMappingService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/referral-detail")
public class ReferralDetailController {
    @Autowired
    private ReferralMappingService referralMappingService;

    @Autowired
    private ReferralBenefitLogService referralBenefitLogService;

    @GetMapping("/get-referral-detail-for-beneficiary")
    public ResponseEntity<List<ReferralDetailDTO>>getReferralDetailForBeneficiary(String beneficiary,String userId,@RequestAttribute("user") CustomUserDetails userDetails){
        return ResponseEntity.ok(referralMappingService.findReferralDetailForBeneficiary(beneficiary,userId,userDetails));
    }

    @PostMapping("/get-referral-benefit-logs")
    public ResponseEntity<List<ReferralBenefitLogDTO>>getReferralBenfitLogs(String beneficiary, String userId, @RequestBody List<String>status, @RequestAttribute("user") CustomUserDetails userDetails){
        return ResponseEntity.ok(referralBenefitLogService.getReferralBenefitLogsByUserIdAndReferralMappingIdAndBeneficiaryAndStatusInOrderByCreatedAtDesc(userId,beneficiary,status));
    }

    @GetMapping("/referral-points-count")
    public ResponseEntity<Long>getReferralPointsCount(String userId){
        return ResponseEntity.ok(referralBenefitLogService.getPointsCount(userId));
    }
}
