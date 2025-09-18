package vacademy.io.admin_core_service.features.user_subscription.handler;

import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralBenefitLogs;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogLineItemDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.List;

public interface ReferralBenefitHandler {


   List<ReferralBenefitLogs> processBenefit(String benefitJson,
                                                    ReferralMapping referralMapping,
                                                    ReferralOption referralOption,
                                                    UserPlan userPlan,
                                                    UserDTO userDTO,
                                            String beneficiary,
                                            String status);


    PaymentLogLineItemDTO calculateDiscount(String benefitJson,
                                                   PaymentInitiationRequestDTO paymentInitiationRequestDTO);

    boolean supports(String benefitType);
}
