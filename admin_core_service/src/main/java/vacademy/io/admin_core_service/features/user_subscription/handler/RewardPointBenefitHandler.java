package vacademy.io.admin_core_service.features.user_subscription.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.user_subscription.dto.BenefitConfigDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralBenefitLogs;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitLogsBeneficiary;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitType;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralBenefitLogService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

@Component
public class RewardPointBenefitHandler implements ReferralBenefitHandler {

    @Autowired
    private ReferralBenefitLogService referralBenefitLogService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    @Lazy
    private ReferralBenefitOrchestrator referralBenefitOrchestrator;

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

            BenefitConfigDTO.PointBenefitValue pointValue = objectMapper.convertValue(benefitDTO.getValue(), BenefitConfigDTO.PointBenefitValue.class);

            boolean isForReferee = beneficiary.equalsIgnoreCase(ReferralBenefitLogsBeneficiary.REFEREE.name());
            UserDTO targetUser = isForReferee ? refereeUser : referrer;

            referralBenefitLogService.createLog(
                    referralMapping.getUserPlan(),
                    referralMapping,
                    targetUser.getId(),
                    ReferralBenefitType.POINTS.name(),
                    beneficiary,
                    objectMapper.writeValueAsString(pointValue), // Log the specific points value
                    status
            );

            if (benefitDTO.getPointTriggers() != null && !benefitDTO.getPointTriggers().isEmpty()) {
                List<ReferralBenefitLogs>referralBenefitLogs = referralBenefitLogService.findByUserIdAndBenefitTypeAndStatusIn(targetUser.getId(),ReferralBenefitType.POINTS.name(),List.of(ReferralStatusEnum.ACTIVE.name()));
                long points = getPointsCount(referralBenefitLogs);
                if (status.equalsIgnoreCase(ReferralStatusEnum.PENDING.name())){
                    points += pointValue.getPoints();
                }
            }

        } catch (Exception e) {
            throw new VacademyException("Failed to process reward point benefit"+e.getMessage());
        }
    }

    private long getPointsCount(List<ReferralBenefitLogs>referralBenefitLogs){
        if (referralBenefitLogs == null || referralBenefitLogs.isEmpty()){
            return 0;
        }
        return referralBenefitLogs.stream().mapToLong(log -> JsonUtil.fromJson(log.getBenefitValue(),BenefitConfigDTO.PointBenefitValue.class).getPoints()).sum();
    }
}