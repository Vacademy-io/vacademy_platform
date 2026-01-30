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
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;

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

    @Autowired
    private vacademy.io.admin_core_service.features.user_subscription.service.PaymentPlanService paymentPlanService;

    @Autowired
    private vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService paymentOptionService;

    @Autowired
    private AuthService authService;

    @Transactional
    public LearnerEnrollResponseDTO enrollMultiPackage(MultiPackageLearnerEnrollRequestDTO request) {

        // Handle case where only userId is provided
        if (request.getUser() == null && StringUtils.hasText(request.getUserId())) {
            log.info("Fetching user details for userId: {}", request.getUserId());
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(request.getUserId()));
            if (users.isEmpty()) {
                throw new VacademyException("User not found with ID: " + request.getUserId());
            }
            request.setUser(users.get(0));
        }

        if (request.getUser() == null) {
            throw new VacademyException("User details, or a valid userId, are required for enrollment");
        }
        log.info("Processing multi-package enrollment for user: {}", request.getUser().getEmail());

        List<LearnerPackageSessionEnrollmentItemDTO> items = request.getLearnerPackageSessionEnrollments();
        if (items == null || items.isEmpty()) {
            throw new VacademyException("No package sessions provided for enrollment");
        }

        // 0. Initialize PaymentInitiationRequest if missing
        if (request.getPaymentInitiationRequest() == null) {
            request.setPaymentInitiationRequest(new PaymentInitiationRequestDTO());
        }
        PaymentInitiationRequestDTO paymentInit = request.getPaymentInitiationRequest();

        // 0.1 Calculate Total Amount if missing
        if (paymentInit.getAmount() == null || paymentInit.getAmount() == 0.0) {
            double totalAmount = 0.0;
            for (LearnerPackageSessionEnrollmentItemDTO item : items) {
                if (StringUtils.hasText(item.getPlanId())) {
                    vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan plan = paymentPlanService
                            .findById(item.getPlanId()).orElse(null);

                } else if (StringUtils.hasText(item.getPaymentOptionId())) {
                    // Fallback to auto-select active plan if planId is missing but paymentOption is
                    // present
                    // This matches the fallback logic in LearnerEnrollRequestService
                    vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption option = paymentOptionService
                            .findById(item.getPaymentOptionId());
                    if (option != null) {
                        List<vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan> relatedPlans = paymentPlanService
                                .findByPaymentOption(option);
                        List<vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan> activePlans = relatedPlans
                                .stream()
                                .filter(p -> "ACTIVE".equalsIgnoreCase(p.getStatus()))
                                .toList();
                        if (activePlans.size() == 1) {
                            vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan autoPlan = activePlans
                                    .get(0);
                            log.info("Auto-calculated price from single ACTIVE plan: {}", autoPlan.getId());

                        }
                    }
                }
            }
            log.info("Calculated total amount for multi-package enrollment: {}", totalAmount);
            paymentInit.setAmount(totalAmount);
        }

        // 0.2 Set User Email if missing
        if (!StringUtils.hasText(paymentInit.getEmail()) && request.getUser() != null) {
            paymentInit.setEmail(request.getUser().getEmail());
        }

        // 1. Ensure a consistent OrderId for the entire multi-package transaction
        if (!StringUtils.hasText(paymentInit.getOrderId())) {
            // Generate Order ID that fits PhonePe's 38-character limit
            // Format: MP{UUID without hyphens} = 34 characters (2 + 32)
            String sharedOrderId = "MP" + java.util.UUID.randomUUID().toString().replace("-", "");
            log.info("Generating shared OrderID for multi-package transaction: {}", sharedOrderId);
            paymentInit.setOrderId(sharedOrderId);
        }

        // 2. Process Main Package (First Item) - This initiates the Payment
        LearnerPackageSessionEnrollmentItemDTO mainItem = items.get(0);

        LearnerEnrollRequestDTO mainRequestDTO = mapToLegacyDTO(request, mainItem);
        // Override amount to TOTAL amount for the main transaction

        Map<String, Object> mainExtraData = new HashMap<>();
        if (request.getPaymentInitiationRequest() != null) {
            mainExtraData.put("OVERRIDE_TOTAL_AMOUNT", request.getPaymentInitiationRequest().getAmount());
        }

        boolean isSkipPayment = false;
        // Check if amount is 0, if so, skip payment initiation automatically
        if (request.getPaymentInitiationRequest() != null &&
                request.getPaymentInitiationRequest().getAmount() != null &&
                request.getPaymentInitiationRequest().getAmount() <= 0) {
            log.info("Total amount is 0, enabling SKIP_PAYMENT_INITIATION and immediate activation");
            isSkipPayment = true;
        }

        // Also skip payment if enrollment type is explicitly MANUAL
        if ("MANUAL".equalsIgnoreCase(request.getEnrollmentType())) {
            log.info("Enrollment type is MANUAL, enabling SKIP_PAYMENT_INITIATION and immediate activation");
            isSkipPayment = true;
        }

        if (isSkipPayment) {
            mainExtraData.put("SKIP_PAYMENT_INITIATION", true);
            mainExtraData.put("IS_MANUAL_ENROLLMENT", true);
            mainExtraData.put("FORCE_PAID_STATUS", true);
        }

        log.info("Enrolling in primary package session: {}", mainItem.getPackageSessionId());
        LearnerEnrollResponseDTO mainResponse = learnerEnrollRequestService.recordLearnerRequest(mainRequestDTO,
                mainExtraData);

        if (mainResponse.getPaymentResponse() == null || mainResponse.getPaymentResponse().getOrderId() == null) {
            // If payment was skipped, getPaymentResponse() might be non-null but we need to
            // ensure we handled it
            if (Boolean.TRUE.equals(mainExtraData.get("SKIP_PAYMENT_INITIATION"))) {
                log.info("Payment initiation skipped for primary package as requested.");
                // We need to ensure we have a valid OrderId (paymentLogId) even if skipped,
                // which handlePaymentWithoutGateway should provide.
                if (mainResponse.getPaymentResponse() == null
                        || mainResponse.getPaymentResponse().getOrderId() == null) {
                    throw new VacademyException("Failed to generate payment log for skipped payment enrollment");
                }
            } else {
                throw new VacademyException("Failed to initiate payment for primary package");
            }
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

            // Inherit Manual/Skip flags from main if applicable
            if (isSkipPayment) {
                log.info("Applying Manual/Skip flags to child enrollment");
                childExtraData.put("IS_MANUAL_ENROLLMENT", true);
                childExtraData.put("FORCE_PAID_STATUS", true);
            }

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
