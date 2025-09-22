package vacademy.io.admin_core_service.features.user_subscription.handler;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
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

    private static final Logger log = LoggerFactory.getLogger(RewardPointBenefitHandler.class);

    @Autowired
    private ReferralBenefitLogService referralBenefitLogService;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    @Lazy
    private ReferralBenefitHandlerFactory benefitHandlerFactory;

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
            UserDTO targetUser = beneficiary.equalsIgnoreCase(ReferralBenefitLogsBeneficiary.REFEREE.name()) ? refereeUser : referrer;

            // Step 1: Log the points being awarded in this transaction.
            referralBenefitLogService.createLog(
                    referralMapping.getUserPlan(),
                    referralMapping,
                    targetUser.getId(),
                    ReferralBenefitType.POINTS.name(),
                    beneficiary,
                    objectMapper.writeValueAsString(pointValue),
                    status
            );


            checkAndProcessPointTriggers(targetUser, benefitDTO, learnerPackageSessionsEnrollDTO, referralOption, paymentOption, referralMapping, refereeUser, referrer, instituteId, beneficiary, status);

        } catch (Exception e) {
            throw new VacademyException("Failed to process reward point benefit: " + e.getMessage());
        }
    }

    /**
     * Checks if awarding points has unlocked new benefits for the user.
     */
    private void checkAndProcessPointTriggers(UserDTO targetUser,
                                              BenefitConfigDTO.BenefitDTO currentBenefit,
                                              LearnerPackageSessionsEnrollDTO enrollDTO,
                                              ReferralOption referralOption,
                                              PaymentOption paymentOption,
                                              ReferralMapping referralMapping,
                                              UserDTO refereeUser,
                                              UserDTO referrer,
                                              String instituteId,
                                              String beneficiary,
                                              String status) {

        if (currentBenefit.getPointTriggers() == null || currentBenefit.getPointTriggers().isEmpty()) {
            return; // No triggers to check for.
        }

        // Calculate user's total points *before* this transaction.
        List<ReferralBenefitLogs> previousPointLogs = referralBenefitLogService.findByUserIdAndBenefitTypeAndStatusIn(targetUser.getId(),ReferralBenefitType.POINTS.name(), List.of(ReferralStatusEnum.ACTIVE.name()));
        long pointsBefore = getPointsCount(previousPointLogs);

        // Calculate user's total points *after* this transaction.
        BenefitConfigDTO.PointBenefitValue newPoints = new BenefitConfigDTO.PointBenefitValue(0);
        if (status.equalsIgnoreCase(ReferralStatusEnum.PENDING.name())){
            newPoints = (BenefitConfigDTO.PointBenefitValue) currentBenefit.getValue();
        }
        long pointsAfter = pointsBefore + newPoints.getPoints();

        log.info("User {} has {} total points after this transaction (previously {}). Checking triggers.", targetUser.getId(), pointsAfter, pointsBefore);

        // Check each trigger defined in the benefit.
        for (BenefitConfigDTO.PointTriggerDTO trigger : currentBenefit.getPointTriggers()) {
            // The user qualifies if their new total meets the requirement AND their old total did not.
            // This prevents rewards from being awarded multiple times.
            if (pointsAfter >= trigger.getPointsRequired()) {
                log.info("User {} has met the trigger for {} points! Processing newly unlocked benefits.", targetUser.getId(), trigger.getPointsRequired());

                // Process each of the newly unlocked benefits using the appropriate handler.
                for (BenefitConfigDTO.BenefitDTO triggeredBenefit : trigger.getBenefits()) {
                    try {
                        ReferralBenefitHandler processor = benefitHandlerFactory.getProcessor(triggeredBenefit);
                        processor.processBenefit(enrollDTO, referralOption, paymentOption, referralMapping, refereeUser, referrer, instituteId, triggeredBenefit, beneficiary, status);
                    } catch (VacademyException e) {
                        log.warn("Skipping triggered benefit due to missing processor for type '{}': {}", triggeredBenefit.getType(), e.getMessage());
                    }
                }
            }
        }
    }

    /**
     * Safely calculates the total points from a list of benefit logs.
     */
    private long getPointsCount(List<ReferralBenefitLogs> referralBenefitLogs) {
        if (referralBenefitLogs == null || referralBenefitLogs.isEmpty()) {
            return 0;
        }
        return referralBenefitLogs.stream().mapToLong(log -> {
            try {
                return objectMapper.readValue(log.getBenefitValue(), BenefitConfigDTO.PointBenefitValue.class).getPoints();
            } catch (JsonProcessingException e) {
                return 0;
            }
        }).sum();
    }
}