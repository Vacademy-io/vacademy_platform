package vacademy.io.admin_core_service.features.user_subscription.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.user_subscription.dto.UserPlanDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.UserPlanFilterDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.UserPlanStatusUpdateRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogFilterRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogWithUserPlanDTO;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/v1/user-plan")
public class UserPlanController {

    @Autowired
    private UserPlanService userPlanService;

    @Autowired
    private PaymentLogService paymentLogService;

    @GetMapping("/{userPlanId}/with-payment-logs")
    public ResponseEntity<UserPlanDTO> getUserPlanWithPaymentLogs(
            @PathVariable String userPlanId,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        UserPlanDTO userPlanDTO = userPlanService.getUserPlanWithPaymentLogs(userPlanId);
        return ResponseEntity.ok(userPlanDTO);
    }

    @PostMapping("/all")
    public ResponseEntity<Page<UserPlanDTO>> getUserPlans(
            @RequestParam(required = false, defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(required = false, defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize,
            @RequestBody UserPlanFilterDTO filterDTO) {

        Page<UserPlanDTO> userPlans = userPlanService.getUserPlansByUserIdAndInstituteId(pageNo, pageSize, filterDTO);
        return ResponseEntity.ok(userPlans);
    }

    @PostMapping("/payment-logs")
    public ResponseEntity<Page<PaymentLogWithUserPlanDTO>> getPaymentLogs(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam(required = false, defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(required = false, defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize,
            @RequestBody PaymentLogFilterRequestDTO filterDTO) {

        Page<PaymentLogWithUserPlanDTO> paymentLogs = paymentLogService
                .getPaymentLogsForInstitute(filterDTO, pageNo, pageSize);
        return ResponseEntity.ok(paymentLogs);
    }

    @PutMapping("/status")
    public ResponseEntity<Void> updateUserPlanStatuses(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody UserPlanStatusUpdateRequestDTO request) {

        userPlanService.updateUserPlanStatuses(request.getUserPlanIds(), request.getStatus());
        return ResponseEntity.ok().build();
    }
}
