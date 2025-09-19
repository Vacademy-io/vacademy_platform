package vacademy.io.admin_core_service.features.user_subscription.handler;

import vacademy.io.admin_core_service.features.user_subscription.dto.BenefitConfigDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;

public interface ReferralBenefitHandler {
    void processBenefit(LearnerPackageSessionsEnrollDTO learnerPackageSessionsEnrollDTO,
                        ReferralOption referralOption,
                        PaymentOption paymentOption,
                        ReferralMapping referralMapping,
                        UserDTO refereeUser,
                        UserDTO referrer,
                        String instituteId,
                        BenefitConfigDTO.BenefitDTO benefitDTO,
                        String beneficiary,
                        String status);
}