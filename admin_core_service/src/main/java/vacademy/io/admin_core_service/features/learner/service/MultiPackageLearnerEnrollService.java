package vacademy.io.admin_core_service.features.learner.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.learner.dto.v2.LearnerPackageSessionEnrollmentItemDTO;
import vacademy.io.admin_core_service.features.learner.dto.v2.MultiPackageLearnerEnrollRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.common.auth.dto.learner.LearnerEnrollRequestDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.util.StringUtils;

@Slf4j
@Service
public class MultiPackageLearnerEnrollService {

    @Autowired
    private LearnerEnrollRequestService learnerEnrollRequestService;

    @Autowired
    private PaymentLogService paymentLogService;

    @Transactional
    public LearnerEnrollResponseDTO enrollMultiPackage(MultiPackageLearnerEnrollRequestDTO request) {
        log.info("Processing multi-package enrollment for user: {}", request.getUser().getEmail());

        List<LearnerPackageSessionEnrollmentItemDTO> items = request.getLearnerPackageSessionEnrollments();
        if (items == null || items.isEmpty()) {
            throw new VacademyException("No package sessions provided for enrollment");
        }

        // 1. Ensure a consistent OrderId for the entire multi-package transaction
        if (request.getPaymentInitiationRequest() != null
                && !StringUtils.hasText(request.getPaymentInitiationRequest().getOrderId())) {
            // Generate Order ID that fits PhonePe's 38-character limit
            // Format: MP{UUID without hyphens} = 34 characters (2 + 32)
            String sharedOrderId = "MP" + java.util.UUID.randomUUID().toString().replace("-", "");
            log.info("Generating shared OrderID for multi-package transaction: {}", sharedOrderId);
            request.getPaymentInitiationRequest().setOrderId(sharedOrderId);
        }

        // 2. Process Main Package (First Item) - This initiates the Payment
        LearnerPackageSessionEnrollmentItemDTO mainItem = items.get(0);

        LearnerEnrollRequestDTO mainRequestDTO = mapToLegacyDTO(request, mainItem);
        // Override amount to TOTAL amount for the main transaction

        Map<String, Object> mainExtraData = new HashMap<>();
        if (request.getPaymentInitiationRequest() != null) {
            mainExtraData.put("OVERRIDE_TOTAL_AMOUNT", request.getPaymentInitiationRequest().getAmount());
        }

        log.info("Enrolling in primary package session: {}", mainItem.getPackageSessionId());
        LearnerEnrollResponseDTO mainResponse = learnerEnrollRequestService.recordLearnerRequest(mainRequestDTO,
                mainExtraData);

        if (mainResponse.getPaymentResponse() == null || mainResponse.getPaymentResponse().getOrderId() == null) {
            throw new VacademyException("Failed to initiate payment for primary package");
        }

        String mainPaymentLogId = mainResponse.getPaymentResponse().getOrderId();
        log.info("Main payment initiated. PaymentLogId/OrderId: {}. Total Amount: {}",
                mainPaymentLogId, request.getPaymentInitiationRequest().getAmount());
        UserDTO enrolledUser = mainResponse.getUser(); // Use the confirmed/created user ID for subsequent calls

        List<String> childPaymentLogIds = new ArrayList<>();

        // 2. Process Remaining Packages
        for (int i = 1; i < items.size(); i++) {
            LearnerPackageSessionEnrollmentItemDTO item = items.get(i);
            log.info("Enrolling in child package session: {}", item.getPackageSessionId());

            LearnerEnrollRequestDTO childRequestDTO = mapToLegacyDTO(request, item);
            childRequestDTO.setUser(enrolledUser); // Ensure same user

            Map<String, Object> childExtraData = new HashMap<>();
            childExtraData.put("SKIP_PAYMENT_INITIATION", true);
            childExtraData.put("PARENT_PAYMENT_LOG_ID", mainPaymentLogId);

            // Handle Rent Case status
            if ("RENT".equalsIgnoreCase(request.getEnrollmentType())) {
                log.info("Marking child enrollment as RENT_REQUESTED");
                childExtraData.put("ENROLLMENT_STATUS", "RENT_REQUESTED");
            }

            LearnerEnrollResponseDTO childResponse = learnerEnrollRequestService.recordLearnerRequest(childRequestDTO,
                    childExtraData);

            if (childResponse.getPaymentResponse() != null) {
                childPaymentLogIds.add(childResponse.getPaymentResponse().getOrderId());
            }
        }

        // 3. Link Child Logs to Main Log
        if (!childPaymentLogIds.isEmpty()) {
            log.info("Linking {} child payment logs to main log {}", childPaymentLogIds.size(), mainPaymentLogId);
            paymentLogService.addChildLogsToPayment(mainPaymentLogId, childPaymentLogIds);
        }

        return mainResponse;
    }

    private LearnerEnrollRequestDTO mapToLegacyDTO(MultiPackageLearnerEnrollRequestDTO request,
            LearnerPackageSessionEnrollmentItemDTO item) {
        LearnerEnrollRequestDTO dto = new LearnerEnrollRequestDTO();
        dto.setUser(request.getUser());
        dto.setInstituteId(request.getInstituteId());
        dto.setLearnerExtraDetails(request.getLearnerExtraDetails());

        LearnerPackageSessionsEnrollDTO enrollDTO = new LearnerPackageSessionsEnrollDTO();
        enrollDTO.setPackageSessionIds(List.of(item.getPackageSessionId()));
        enrollDTO.setPlanId(item.getPlanId());
        enrollDTO.setPaymentOptionId(item.getPaymentOptionId());
        enrollDTO.setEnrollInviteId(item.getEnrollInviteId());
        enrollDTO.setCustomFieldValues(item.getCustomFieldValues());
        enrollDTO.setReferRequest(item.getReferRequest());

        // Copy payment initiation request details if available
        if (request.getPaymentInitiationRequest() != null) {
            PaymentInitiationRequestDTO newInit = new PaymentInitiationRequestDTO();
            PaymentInitiationRequestDTO orig = request.getPaymentInitiationRequest();
            newInit.setAmount(orig.getAmount()); // Will be overridden for Main, but good to have
            newInit.setCurrency(orig.getCurrency());
            newInit.setVendor(orig.getVendor());
            newInit.setVendorId(orig.getVendorId());
            newInit.setEmail(orig.getEmail());
            newInit.setOrderId(orig.getOrderId()); // Sync the shared orderId
            newInit.setInstituteId(request.getInstituteId());
            newInit.setPhonePeRequest(orig.getPhonePeRequest()); // IMPORTANT
            // Add other fields as necessary

            enrollDTO.setPaymentInitiationRequest(newInit);
        }

        dto.setLearnerPackageSessionEnroll(enrollDTO);
        return dto;
    }
}
