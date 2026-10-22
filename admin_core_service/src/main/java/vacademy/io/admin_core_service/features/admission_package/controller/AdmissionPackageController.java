package vacademy.io.admin_core_service.features.admission_package.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.admin_activity_logs.annotation.Auditable;
import vacademy.io.admin_core_service.features.admission_package.dto.AdmissionPackagePaymentPreviewDTO;
import vacademy.io.admin_core_service.features.admission_package.dto.AdmissionPackageSummaryDTO;
import vacademy.io.admin_core_service.features.admission_package.service.AdmissionPackagePaymentService;
import vacademy.io.admin_core_service.features.fee_management.dto.RecordOfflinePaymentRequestDTO;
import vacademy.io.admin_core_service.features.fee_management.service.FeeAccessGuard;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.util.List;

/**
 * Admission packages in the learner side view: the package totals, and a payment recorded
 * against the whole package with one receipt. Staff of the package's institute only.
 */
@RestController
@RequestMapping("/admin-core-service/v1/fee-management")
@RequiredArgsConstructor
public class AdmissionPackageController {

    private final AdmissionPackagePaymentService admissionPackagePaymentService;
    private final FeeAccessGuard feeAccessGuard;

    @GetMapping("/user/{userId}/admission-packages")
    public ResponseEntity<List<AdmissionPackageSummaryDTO>> listForUser(
            @PathVariable String userId,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        feeAccessGuard.requireStaff(user, instituteId);
        return ResponseEntity.ok(admissionPackagePaymentService.listForUser(userId, instituteId));
    }

    /** How a payment would be shared between the package's courses. Saves nothing. */
    @PostMapping("/admission-package/{packageId}/record-offline-payment/preview")
    public ResponseEntity<AdmissionPackagePaymentPreviewDTO> previewPayment(
            @PathVariable String packageId,
            @RequestBody RecordOfflinePaymentRequestDTO request,
            @RequestAttribute("user") CustomUserDetails user) {
        feeAccessGuard.requireStaff(user, admissionPackagePaymentService.instituteOf(packageId));
        if (request == null || request.getAmount() == null) {
            throw new VacademyException("Enter an amount");
        }
        return ResponseEntity.ok(admissionPackagePaymentService.previewPayment(
                packageId, BigDecimal.valueOf(request.getAmount())));
    }

    @PostMapping("/admission-package/{packageId}/record-offline-payment")
    @Auditable(
            entityType = "PAYMENT",
            action = "CREATE",
            entityIdExpr = "#packageId",
            descriptionExpr = "'recorded an offline payment of ' + #request?.amount + ' on admission package ' + #packageId")
    public ResponseEntity<AdmissionPackageSummaryDTO> recordPayment(
            @PathVariable String packageId,
            @RequestBody RecordOfflinePaymentRequestDTO request,
            @RequestAttribute("user") CustomUserDetails user) {
        feeAccessGuard.requireStaff(user, admissionPackagePaymentService.instituteOf(packageId));
        return ResponseEntity.ok(admissionPackagePaymentService.recordPayment(
                packageId, request, user != null ? user.getUserId() : null));
    }
}
