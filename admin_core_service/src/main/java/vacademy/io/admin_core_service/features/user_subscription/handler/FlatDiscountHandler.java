package vacademy.io.admin_core_service.features.user_subscription.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.user_subscription.dto.FlatDiscountBenefitDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogLineItemDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralBenefitDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.*;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitType;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.List;

@Component
public class FlatDiscountHandler implements ReferralBenefitHandler {

    @Autowired
    private ObjectMapper objectMapper;

    @Override
    public List<ReferralBenefitLogs> processBenefit(String benefitJson, ReferralMapping referralMapping, ReferralOption referralOption, UserPlan userPlan, UserDTO userDTO, String beneficiary, String status) {
        try {
            ReferralBenefitLogs benefitLog = ReferralBenefitLogs.builder()
                .userPlan(userPlan)
                .referralMapping(referralMapping)
                .userId(userDTO.getId())
                .benefitType(ReferralBenefitType.FLAT_DISCOUNT.name())
                .beneficiary(beneficiary)
                .benefitValue(benefitJson)
                .status(status)
                .build();
            return List.of(benefitLog);
        } catch (Exception e) {
            throw new RuntimeException("Failed to process flat discount benefit log", e);
        }
    }

    @Override
    public PaymentLogLineItemDTO calculateDiscount(String benefitJson, PaymentInitiationRequestDTO paymentInitiationRequestDTO) {
        try {
            ReferralBenefitDTO referralBenefitDTO = objectMapper.readValue(benefitJson, ReferralBenefitDTO.class);
            FlatDiscountBenefitDTO flatDiscount = objectMapper.convertValue(referralBenefitDTO.getBenefitValue(), FlatDiscountBenefitDTO.class);

            double discountAmount = flatDiscount.getAmount();

            // Ensure the discount does not make the amount negative
            discountAmount = Math.min(discountAmount, paymentInitiationRequestDTO.getAmount());

            paymentInitiationRequestDTO.setAmount(paymentInitiationRequestDTO.getAmount() - discountAmount);

            PaymentLogLineItemDTO lineItem = new PaymentLogLineItemDTO();
            lineItem.setDescription("Referral Discount");
            lineItem.setAmount(-discountAmount);
            lineItem.setCurrency(paymentInitiationRequestDTO.getCurrency());
            lineItem.setType("FLAT_DISCOUNT");

            return lineItem;
        } catch (Exception e) {
            throw new RuntimeException("Failed to calculate flat discount", e);
        }
    }

    @Override
    public boolean supports(String benefitType) {
        return ReferralBenefitType.FLAT_DISCOUNT.name().equalsIgnoreCase(benefitType);
    }
}
