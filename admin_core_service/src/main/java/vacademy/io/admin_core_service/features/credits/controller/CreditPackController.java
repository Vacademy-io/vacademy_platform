package vacademy.io.admin_core_service.features.credits.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.credits.dto.CreditPackDTO;
import vacademy.io.admin_core_service.features.credits.dto.CreditPackOrderStatusDTO;
import vacademy.io.admin_core_service.features.credits.dto.CreditPackPurchaseRequestDTO;
import vacademy.io.admin_core_service.features.credits.dto.CreditPackPurchaseResponseDTO;
import vacademy.io.admin_core_service.features.credits.service.CreditPackService;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformPayment;
import vacademy.io.admin_core_service.features.platform_billing.repository.PlatformPaymentRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

/**
 * Endpoints for the AI credit pack purchase flow.
 *
 *   GET    /admin-core-service/credits/packs?instituteId=...
 *   POST   /admin-core-service/credits/packs/purchase
 *   GET    /admin-core-service/credits/packs/orders/{platformPaymentId}/status
 *
 * All three require an authenticated user (any institute admin) — auth is
 * applied by the global filter that populates the {@code user} request
 * attribute. The webhook itself lives at PlatformWebHookController.
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/credits/packs")
public class CreditPackController {

    @Autowired
    private CreditPackService creditPackService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    @Autowired
    private PlatformPaymentRepository platformPaymentRepository;

    @GetMapping
    public ResponseEntity<List<CreditPackDTO>> listPacks(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(creditPackService.listPacksForInstitute(instituteId));
    }

    @PostMapping("/purchase")
    public ResponseEntity<CreditPackPurchaseResponseDTO> purchase(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestBody CreditPackPurchaseRequestDTO request) {
        if (request == null || request.getInstituteId() == null || request.getPackId() == null) {
            throw new VacademyException("instituteId and packId are required");
        }
        instituteAccessValidator.validateUserAccess(user, request.getInstituteId());
        UserDTO buyer = toUserDTO(user);
        CreditPackPurchaseResponseDTO response = creditPackService.createOrder(
                request.getInstituteId(), request.getPackId(), buyer, request.getReturnUrl());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/orders/{platformPaymentId}/status")
    public ResponseEntity<CreditPackOrderStatusDTO> getOrderStatus(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable("platformPaymentId") String platformPaymentId) {
        // Resolve the order's owning institute, then verify the caller is a
        // member. Without this an attacker who guesses UUIDs could enumerate
        // other institutes' purchase statuses.
        PlatformPayment payment = platformPaymentRepository.findById(platformPaymentId)
                .orElseThrow(() -> new VacademyException("Order not found: " + platformPaymentId));
        instituteAccessValidator.validateUserAccess(user, payment.getInstituteId());
        return ResponseEntity.ok(creditPackService.getOrderStatus(platformPaymentId));
    }

    private static UserDTO toUserDTO(CustomUserDetails user) {
        if (user == null) {
            return null;
        }
        return UserDTO.builder()
                .id(user.getUserId())
                .username(user.getUsername())
                .email(user.getEmail())
                .build();
    }
}
