package vacademy.io.admin_core_service.features.user_subscription.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.user_subscription.dto.ContentBenefitsConfigDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralBenefitDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.*;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitType;
import vacademy.io.admin_core_service.features.user_subscription.service.MultiChannelDeliveryService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogLineItemDTO;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.ArrayList;
import java.util.List;

@Component
public class ContentBenefitHandler implements ReferralBenefitHandler {

    @Autowired private ObjectMapper objectMapper;
    @Autowired private MultiChannelDeliveryService multiChannelDeliveryService;
    @Autowired private AuthService authService;
    @Autowired private MediaService mediaService;

    @Override
    public List<ReferralBenefitLogs> processBenefit(
            String benefitJson,
            ReferralMapping referralMapping,
            ReferralOption referralOption,
            UserPlan userPlan,
            UserDTO refereeUser,
            String beneficiary,
            String status) {

        try {
            // Parse JSON into wrapper DTO
            ReferralBenefitDTO referralBenefitDTO =
                    objectMapper.readValue(benefitJson, ReferralBenefitDTO.class);

            // Convert inner value into config DTO
            ContentBenefitsConfigDTO contentBenefitsConfig =
                    objectMapper.convertValue(referralBenefitDTO.getBenefitValue(),
                            ContentBenefitsConfigDTO.class);

            // Fetch referrer user from Auth Service
            UserDTO referrerUser = authService
                    .getUsersFromAuthServiceByUserIds(List.of(referralMapping.getReferrerUserId()))
                    .stream()
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException(
                            "Referrer user not found for ID: " + referralMapping.getReferrerUserId()
                    ));

            // Deliver content benefits
            processAndDeliverContent(contentBenefitsConfig, referrerUser, refereeUser, userPlan.getEnrollInvite().getInstituteId());

            // Create referral benefit log
            ReferralBenefitLogs benefitLog = ReferralBenefitLogs.builder()
                    .userPlan(userPlan)
                    .referralMapping(referralMapping)
                    .userId(refereeUser.getId()) // beneficiary triggering the event
                    .benefitType(ReferralBenefitType.CONTENT.name())
                    .beneficiary(beneficiary)
                    .benefitValue(objectMapper.writeValueAsString(contentBenefitsConfig))
                    .status(status)
                    .build();

            return List.of(benefitLog);

        } catch (Exception e) {
            throw new RuntimeException("Failed to process content benefit", e);
        }
    }

    private void processAndDeliverContent(ContentBenefitsConfigDTO contentBenefitsConfig,
                                          UserDTO referrerUser,
                                          UserDTO refereeUser,
                                          String instituteId) throws Exception {

        if (contentBenefitsConfig.getReferralBenefits() == null) {
            return;
        }

        for (ContentBenefitsConfigDTO.ReferralBenefitTierDTO tier : contentBenefitsConfig.getReferralBenefits()) {
            processTierRecursively(tier, referrerUser, refereeUser, instituteId);
        }
    }

    private void processTierRecursively(ContentBenefitsConfigDTO.ReferralBenefitTierDTO tier,
                                        UserDTO referrerUser,
                                        UserDTO refereeUser,
                                        String instituteId) throws Exception {

        // Process leaf-level benefits
        if (tier.getBenefits() != null) {
            for (ContentBenefitsConfigDTO.BenefitDTO benefit : tier.getBenefits()) {
                List<FileDetailsDTO> fileDetails = new ArrayList<>();
                if (benefit.getFileIds() != null && !benefit.getFileIds().isEmpty()) {
                    fileDetails = mediaService.getFilesByIds(benefit.getFileIds());
                }

                // Deliver for referrer
                multiChannelDeliveryService.deliverContent(
                        benefit,
                        referrerUser,
                        refereeUser,
                        instituteId,
                        fileDetails,
                        true
                );

                // Deliver for referee
                multiChannelDeliveryService.deliverContent(
                        benefit,
                        referrerUser,
                        refereeUser,
                        instituteId,
                        fileDetails,
                        false
                );
            }
        }

        // Recurse into nested tiers
        if (tier.getReferralBenefits() != null) {
            for (ContentBenefitsConfigDTO.ReferralBenefitTierDTO nested : tier.getReferralBenefits()) {
                processTierRecursively(nested, referrerUser, refereeUser, instituteId);
            }
        }
    }

    @Override
    public PaymentLogLineItemDTO calculateDiscount(String benefitJson,
                                                   PaymentInitiationRequestDTO paymentInitiationRequestDTO) {
        // Content benefits are not monetary discounts
        return null;
    }

    @Override
    public boolean supports(String benefitType) {
        return ReferralBenefitType.CONTENT.name().equalsIgnoreCase(benefitType);
    }
}
