package vacademy.io.admin_core_service.features.institute.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.institute.dto.PaymentGatewayMappingDTO;
import vacademy.io.admin_core_service.features.institute.dto.PaymentGatewayMappingUpsertRequest;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;

/**
 * Admin-only CRUD for institute payment gateway mappings.
 *
 * Lets institute admins self-serve Stripe / Razorpay / PhonePe / Cashfree / Eway
 * credentials from the settings UI instead of needing the ops team to insert
 * rows directly into the database.
 *
 * Auth model mirrors {@link vacademy.io.admin_core_service.features.white_label.controller.WhiteLabelController}:
 * not under /admin/* (so institute admins can call it) but every endpoint asserts
 * the caller belongs to the target instituteId via {@link InstituteAccessValidator}.
 *
 * Secrets are masked on read and merge-on-write so the full value never has to
 * round-trip through the browser after the first save.
 */
@RestController
@RequestMapping("/admin-core-service/v1/institute/payment-gateways")
@RequiredArgsConstructor
public class InstitutePaymentGatewayAdminController {

    private final InstitutePaymentGatewayMappingService paymentGatewayMappingService;
    private final InstituteAccessValidator instituteAccessValidator;

    @GetMapping
    public ResponseEntity<List<PaymentGatewayMappingDTO>> list(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(paymentGatewayMappingService.listForInstitute(instituteId));
    }

    @PostMapping
    public ResponseEntity<PaymentGatewayMappingDTO> create(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestBody PaymentGatewayMappingUpsertRequest request) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(paymentGatewayMappingService.createMapping(instituteId, request));
    }

    @PutMapping("/{mappingId}")
    public ResponseEntity<PaymentGatewayMappingDTO> update(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @PathVariable("mappingId") String mappingId,
            @RequestBody PaymentGatewayMappingUpsertRequest request) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(paymentGatewayMappingService.updateMapping(instituteId, mappingId, request));
    }

    @DeleteMapping("/{mappingId}")
    public ResponseEntity<Map<String, Object>> deactivate(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @PathVariable("mappingId") String mappingId) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        paymentGatewayMappingService.deactivateMapping(instituteId, mappingId);
        return ResponseEntity.ok(Map.of("status", "INACTIVE", "id", mappingId));
    }
}
