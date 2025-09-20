package vacademy.io.admin_core_service.features.user_subscription.handler;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.user_subscription.dto.BenefitConfigDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitLogsBeneficiary;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.ReferralMappingRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralOptionService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ReferralBenefitOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(ReferralBenefitOrchestrator.class);

    @Autowired
    private ReferralMappingRepository referralMappingRepository;
    @Autowired
    private ReferralBenefitHandlerFactory benefitHandlerFactory;
    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ReferralOptionService referralOptionService;

    @Autowired
    private AuthService authService;

    /**
     * The main entry point for processing all referral benefits for a new enrollment.
     */
    public void processAllBenefits(LearnerPackageSessionsEnrollDTO enrollDTO, PaymentOption paymentOption, UserPlan userPlan, UserDTO refereeUser,String instituteId) {

        ReferralOption referralOption = referralOptionService.findById(enrollDTO.getReferRequest().getReferralOptionId()).orElseThrow(() -> new VacademyException("Referral Option not found"));

        UserDTO referrer = authService.getUsersFromAuthServiceByUserIds(List.of(enrollDTO.getReferRequest().getReferrerUserId())).get(0);

        String status = getReferralMappingStatus(paymentOption);

        ReferralMapping referralMapping = createReferralMapping(
                referrer.getId(),
                refereeUser.getId(),
                enrollDTO.getReferRequest().getReferralCode(),
                userPlan,
                status,
                referralOption
        );

        // Process benefits for the Referee (the new user)
        processBenefitSet(referralOption.getRefereeDiscountJson(), enrollDTO, referralOption, paymentOption, referralMapping, refereeUser, referrer, instituteId, ReferralBenefitLogsBeneficiary.REFEREE.name(), status);

        // Process benefits for the Referrer (the existing user)
        processBenefitSet(referralOption.getReferrerDiscountJson(), enrollDTO, referralOption, paymentOption, referralMapping, refereeUser, referrer, instituteId, ReferralBenefitLogsBeneficiary.REFERRER.name(), status);
    }

    /**
     * Processes a full set of benefits (e.g., for a referrer or referee) by finding matching tiers and delegating to specific handlers.
     */


    // to do: we have to handle point based triggers
    private void processBenefitSet(String benefitJson, LearnerPackageSessionsEnrollDTO enrollDTO, ReferralOption referralOption, PaymentOption paymentOption, ReferralMapping referralMapping, UserDTO refereeUser, UserDTO referrer, String instituteId, String beneficiary, String status) {
        if (benefitJson == null || benefitJson.isBlank()) {
            return; // No benefits to process
        }

        try {
            BenefitConfigDTO config = objectMapper.readValue(benefitJson, new TypeReference<>() {});
            long activeReferralCount = referralMappingRepository.countActiveReferralsByReferrerUserId(referrer.getId());

            List<BenefitConfigDTO.BenefitTierDTO> matchingTiers = findTiersForReferralCount(config.getTiers(), activeReferralCount,status);

            for (BenefitConfigDTO.BenefitTierDTO tier : matchingTiers) {
                if (tier.getBenefits() == null) continue;

                for (BenefitConfigDTO.BenefitDTO benefit : tier.getBenefits()) {
                    try {
                        // Use the factory to get the correct processor for the specific benefit
                        ReferralBenefitHandler processor = benefitHandlerFactory.getProcessor(benefit);

                        // Delegate the processing to the found handler
                        processor.processBenefit(enrollDTO, referralOption, paymentOption, referralMapping, refereeUser, referrer, instituteId, benefit, beneficiary, status);

                    } catch (VacademyException e) {
                        log.warn("Skipping benefit due to missing processor: {}", e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to process benefit set for beneficiary [{}]: {}", beneficiary, e.getMessage(), e);
            throw new VacademyException("Error processing referral benefits.");
        }
    }

    private List<BenefitConfigDTO.BenefitTierDTO> findTiersForReferralCount(
            List<BenefitConfigDTO.BenefitTierDTO> tiers,
            long count,
            String status
    ) {
        long effectiveCount = count;
        if (ReferralStatusEnum.PENDING.name().equalsIgnoreCase(status)) {
            effectiveCount++;
        }

        if (tiers == null || tiers.isEmpty()) {
            return new ArrayList<>();
        }

        final long finalCount = effectiveCount;

        return tiers.stream()
                .filter(tier -> {
                    BenefitConfigDTO.ReferralRangeDTO range = tier.getReferralRange();
                    if (range == null) return false;

                    Integer min = range.getMin();
                    Integer max = range.getMax();

                    return (min == null || finalCount >= min) &&
                            (max == null || finalCount <= max);
                })
                .collect(Collectors.toList());
    }



    private ReferralMapping createReferralMapping(String referrerId, String refereeId, String referralCode, UserPlan userPlan, String status, ReferralOption referralOption) {
        ReferralMapping mapping = ReferralMapping.builder()
                .referrerUserId(referrerId)
                .refereeUserId(refereeId)
                .referralCode(referralCode)
                .userPlan(userPlan)
                .status(status)
                .referralOption(referralOption)
                .build();
        return referralMappingRepository.save(mapping);
    }

    private String getReferralMappingStatus(PaymentOption paymentOption) {
        String type = paymentOption.getType();
        if (paymentOption.isRequireApproval()){
            return ReferralStatusEnum.PENDING.name();
        }
        if (PaymentOptionType.FREE.name().equalsIgnoreCase(type) || PaymentOptionType.DONATION.name().equalsIgnoreCase(type)) {
            return ReferralStatusEnum.ACTIVE.name();
        } else if (PaymentOptionType.SUBSCRIPTION.name().equalsIgnoreCase(type) || PaymentOptionType.ONE_TIME.name().equalsIgnoreCase(type)) {
            return ReferralStatusEnum.PENDING.name();
        }
        // Default to PENDING if type is unknown, to be safe
        return ReferralStatusEnum.PENDING.name();
    }
}