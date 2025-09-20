package vacademy.io.admin_core_service.features.user_subscription.handler;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.user_subscription.dto.BenefitConfigDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitLogsBeneficiary;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitType;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralBenefitLogService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;

@Component
public class FlatDiscountHandler implements ReferralBenefitHandler {

    @Autowired
    private ReferralBenefitLogService referralBenefitLogService;

    @Override
    public void processBenefit(LearnerPackageSessionsEnrollDTO learnerPackageSessionsEnrollDTO,
                               ReferralOption referralOption,
                               PaymentOption paymentOption,
                               ReferralMapping referralMapping,
                               UserDTO refereeUser,
                               UserDTO referrer,
                               String instituteId,
                               BenefitConfigDTO.BenefitDTO benefitDTO,
                               String beneficiary,
                               String status) {

        // Safely cast the benefit value
        BenefitConfigDTO.FlatDiscountValue flatDiscountValue = (BenefitConfigDTO.FlatDiscountValue) benefitDTO.getValue();
        double discountAmount = getDiscountedAmount(learnerPackageSessionsEnrollDTO, flatDiscountValue);

        // Apply the flat discount to the payment request amount
        learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest().setAmount(
                learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest().getAmount() - discountAmount
        );

        // Determine the correct user ID for logging purposes
        String targetUserId = beneficiary.equalsIgnoreCase(ReferralBenefitLogsBeneficiary.REFEREE.name())
                ? refereeUser.getId()
                : referrer.getId();

        // Create a log entry for this benefit transaction
        referralBenefitLogService.createLog(
                referralMapping.getUserPlan(),
                referralMapping,
                targetUserId,
                ReferralBenefitType.FLAT_DISCOUNT.name(),
                beneficiary,
                String.valueOf(flatDiscountValue), // Log the actual discount amount applied
                status
        );
    }

    private double getDiscountedAmount(LearnerPackageSessionsEnrollDTO learnerPackageSessionsEnrollDTO, BenefitConfigDTO.FlatDiscountValue flatDiscountValue) {
        // Ensure the discount does not exceed the total amount
        double amount = learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest().getAmount();
        return Math.min(amount, flatDiscountValue.getAmount());
    }
}