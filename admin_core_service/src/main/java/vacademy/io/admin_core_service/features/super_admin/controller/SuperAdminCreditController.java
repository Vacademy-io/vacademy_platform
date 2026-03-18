package vacademy.io.admin_core_service.features.super_admin.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.credits.client.CreditClient;
import vacademy.io.admin_core_service.features.super_admin.dto.CreditGrantRequestDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/super-admin/v1")
public class SuperAdminCreditController {

    @Autowired
    private CreditClient creditClient;

    @PostMapping("/institutes/{instituteId}/grant-credits")
    public ResponseEntity<Map<String, Object>> grantCredits(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String instituteId,
            @RequestBody CreditGrantRequestDTO request) {
        try {
            SuperAdminAuthUtil.requireSuperAdmin(user);
            Map<String, Object> result = creditClient.grantCredits(instituteId, request.getAmount(), request.getDescription());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error granting credits to institute {}: {}", instituteId, e.getMessage());
            throw e;
        }
    }

    @PostMapping("/institutes/{instituteId}/deduct-credits")
    public ResponseEntity<Map<String, Object>> deductCredits(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String instituteId,
            @RequestBody CreditGrantRequestDTO request) {
        try {
            SuperAdminAuthUtil.requireSuperAdmin(user);
            Map<String, Object> result = creditClient.deductCreditsAdmin(
                    instituteId, request.getAmount(), request.getDescription());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error deducting credits from institute {}: {}", instituteId, e.getMessage());
            throw e;
        }
    }
}
