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
public class PercentageDiscountHandler implements ReferralBenefitHandler {

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

        BenefitConfigDTO.PercentageDiscountValue percentageDiscountValue = (BenefitConfigDTO.PercentageDiscountValue) benefitDTO.getValue();
        double discountedAmount = getDiscountedAmount(learnerPackageSessionsEnrollDTO, percentageDiscountValue);

        // Apply the discount to the payment request
        learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest().setAmount(
                learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest().getAmount() - discountedAmount
        );

        // Correctly determine the user ID for the log
        String targetUserId = beneficiary.equalsIgnoreCase(ReferralBenefitLogsBeneficiary.REFEREE.name())
                ? refereeUser.getId()
                : referrer.getId();

        // Create the benefit log
        referralBenefitLogService.createLog(
                referralMapping.getUserPlan(),
                referralMapping,
                targetUserId,
                ReferralBenefitType.PERCENTAGE_DISCOUNT.name(),
                beneficiary,
                String.valueOf(discountedAmount),
                status
        );
    }

    private double getDiscountedAmount(LearnerPackageSessionsEnrollDTO learnerPackageSessionsEnrollDTO, BenefitConfigDTO.PercentageDiscountValue percentageDiscountValue) {
        double amount = learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest().getAmount();
        double discount = amount * percentageDiscountValue.getPercentage() / 100.0;

        // Assuming your DTO has a max discount field
        if (percentageDiscountValue.getMaxDiscount() != null && discount > percentageDiscountValue.getMaxDiscount()) {
            return percentageDiscountValue.getMaxDiscount();
        }
        return discount;
    }
}