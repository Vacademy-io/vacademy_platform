package vacademy.io.admin_core_service.features.user_subscription.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.user_subscription.dto.PercentageDiscountBenefitDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralBenefitDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralBenefitLogs;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitType;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogLineItemDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.ArrayList;
import java.util.List;

@Component
public class PercentageDiscountHandler implements ReferralBenefitHandler {

    @Autowired
    private ObjectMapper objectMapper;

    @Override
    public List<ReferralBenefitLogs> processBenefit(String benefitJson,
            ReferralMapping referralMapping,
            ReferralOption referralOption,
            UserPlan userPlan,
            UserDTO userDTO,String beneficiary,String status) {
        List<ReferralBenefitLogs> benefitLogs = new ArrayList<>();

        try {
            ReferralBenefitDTO referralBenefitDTO = JsonUtil.fromJson(benefitJson, ReferralBenefitDTO.class);
            Object benefitValue = referralBenefitDTO.getBenefitValue();

            ReferralBenefitLogs refereeBenefitLog = ReferralBenefitLogs.builder()
                    .userPlan(userPlan)
                    .referralMapping(referralMapping)
                    .userId(userDTO.getId())
                    .benefitType(ReferralBenefitType.PERCENTAGE_DISCOUNT.name())
                    .beneficiary(beneficiary)
                    .benefitValue(JsonUtil.toJson(benefitValue))
                    .status(status)
                    .build();

            benefitLogs.add(refereeBenefitLog);

        } catch (Exception e) {
            throw new RuntimeException("Failed to process percentage discount benefit", e);
        }

        return benefitLogs;
    }

    @Override
    public PaymentLogLineItemDTO calculateDiscount(String benefitJson,
                                                   PaymentInitiationRequestDTO paymentInitiationRequestDTO) {
        try {
            ReferralBenefitDTO referralBenefitDTO = JsonUtil.fromJson(benefitJson, ReferralBenefitDTO.class);
            Object benefitValue = referralBenefitDTO.getBenefitValue();
            PercentageDiscountBenefitDTO percentageDiscountBenefitDTO = JsonUtil.convertValue(benefitValue, PercentageDiscountBenefitDTO.class);

            double discountAmount = (paymentInitiationRequestDTO.getAmount() * percentageDiscountBenefitDTO.getPercentage()) / 100.0;
            if (percentageDiscountBenefitDTO.isApplyMaximumDiscountAmount()){
                discountAmount = Math.min(discountAmount, percentageDiscountBenefitDTO.getMaxDiscountAmount());
            }
            paymentInitiationRequestDTO.setAmount(paymentInitiationRequestDTO.getAmount() - discountAmount);
            PaymentLogLineItemDTO lineItem = new PaymentLogLineItemDTO();
            lineItem.setDescription("Referral Discount (" + discountAmount + "%)");
            lineItem.setAmount(-discountAmount);
            lineItem.setCurrency(paymentInitiationRequestDTO.getCurrency());
            lineItem.setType("PERCENTAGE_DISCOUNT");

            return lineItem;

        } catch (Exception e) {
            throw new RuntimeException("Failed to calculate percentage discount", e);
        }
    }

    @Override
    public boolean supports(String benefitType) {
        return ReferralBenefitType.PERCENTAGE_DISCOUNT.name().equals(benefitType);
    }
}
