package vacademy.io.admin_core_service.features.user_subscription.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.user_subscription.dto.BenefitConfigDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitLogsBeneficiary;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitType;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.MultiChannelDeliveryService;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralBenefitLogService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.media.dto.FileDetailsDTO;

import java.util.ArrayList;
import java.util.List;

@Component
@Primary
public class ContentBenefitProcessor extends AbstractReferralProcessableBenefit {

    @Autowired
    private MediaService mediaService;
    @Autowired
    private MultiChannelDeliveryService multiChannelDeliveryService;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    @Lazy
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
        try {
            BenefitConfigDTO.ContentBenefitValue contentValue = objectMapper.convertValue(benefitDTO.getValue(), BenefitConfigDTO.ContentBenefitValue.class);

            // If the referral is immediately active, deliver the content now using the new robust method.
            if (status.equalsIgnoreCase(ReferralStatusEnum.ACTIVE.name())) {
                boolean isForReferee = beneficiary.equalsIgnoreCase(ReferralBenefitLogsBeneficiary.REFEREE.name());

                // Call the new unified notification method
                multiChannelDeliveryService.sendReferralNotification(
                        referrer,
                        refereeUser,
                        contentValue,
                        ReferralBenefitType.CONTENT,
                        instituteId,
                        referralMapping,
                        isForReferee
                );
            }

            // Always create a log, regardless of status (PENDING benefits will be processed later)
            String targetUserId = beneficiary.equalsIgnoreCase(ReferralBenefitLogsBeneficiary.REFEREE.name())
                    ? refereeUser.getId()
                    : referrer.getId();

            referralBenefitLogService.createLog(
                    referralMapping.getUserPlan(),
                    referralMapping,
                    targetUserId,
                    ReferralBenefitType.CONTENT.name(),
                    beneficiary,
                    objectMapper.writeValueAsString(contentValue),
                    status
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to process content benefit", e);
        }
    }

    @Override
    public void processPendingBenefit(String benefitJson, String beneficiary, ReferralMapping referralMapping, UserDTO referee, UserDTO referrer, String instituteId) {
        try {
            // Deserialize the benefit value from the log
            BenefitConfigDTO.ContentBenefitValue contentValue = objectMapper.readValue(benefitJson, BenefitConfigDTO.ContentBenefitValue.class);

            boolean isForReferee = beneficiary.equalsIgnoreCase(ReferralBenefitLogsBeneficiary.REFEREE.name());

            // Deliver the content now that the benefit is active using the new robust method
            multiChannelDeliveryService.sendReferralNotification(
                    referrer,
                    referee,
                    contentValue,
                    ReferralBenefitType.CONTENT,
                    instituteId,
                    referralMapping,
                    isForReferee
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to process pending content benefit", e);
        }
    }
}