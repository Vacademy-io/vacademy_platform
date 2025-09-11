package vacademy.io.admin_core_service.features.user_subscription.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralBenefitLogs;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitLogsBeneficiary;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.handler.ReferralBenefitHandler;
import vacademy.io.admin_core_service.features.user_subscription.repository.ReferralBenefitLogsRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.ReferralMappingRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralOptionService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.auth.dto.learner.ReferRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogLineItemDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ReferralHandler {

    @Autowired
    private ReferralMappingRepository referralMappingRepository;

    @Autowired
    private ReferralBenefitLogsRepository referralBenefitLogsRepository;

    @Autowired
    private ReferralOptionService referralOptionService;

    @Autowired
    private List<ReferralBenefitHandler> benefitHandlers;

    @Autowired
    private ObjectMapper objectMapper;

    @Transactional
    public List<PaymentLogLineItemDTO> processReferralRequest(ReferRequestDTO referRequest,
            LearnerPackageSessionsEnrollDTO enrollDTO,
            UserPlan userPlan,
            UserDTO refereeUser,
            UserDTO referrerUser,
            PaymentInitiationRequestDTO paymentInitiationRequestDTO) {

        if (referRequest == null) {
            return new ArrayList<>();
        }

        validateReferralRequest(referRequest, refereeUser);

        ReferralOption referralOption = referralOptionService.getReferralOption(referRequest.getReferralOptionId())
                .orElseThrow(() -> new VacademyException("Referral option not found"));

        ReferralMapping referralMapping = createReferralMapping(referRequest, userPlan, referralOption);
        ReferralMapping savedMapping = referralMappingRepository.save(referralMapping);

        List<PaymentLogLineItemDTO> paymentLineItems = new ArrayList<>();
        List<ReferralBenefitLogs> allBenefitLogs = new ArrayList<>();

        processRefereeBenefits(referralOption, savedMapping, userPlan, refereeUser, paymentInitiationRequestDTO, paymentLineItems,
                allBenefitLogs);
        processReferrerBenefits(referralOption, savedMapping, userPlan, referrerUser, allBenefitLogs);

        if (!allBenefitLogs.isEmpty()) {
            referralBenefitLogsRepository.saveAll(allBenefitLogs);
        }

        return paymentLineItems;
    }

    private void validateReferralRequest(ReferRequestDTO referRequest, UserDTO refereeUser) {
        if (referRequest.getReferrerUserId() == null || referRequest.getReferrerUserId().trim().isEmpty()) {
            throw new VacademyException("Referrer source ID is required");
        }
        if (referRequest.getReferralCode() == null || referRequest.getReferralCode().trim().isEmpty()) {
            throw new VacademyException("Referral code is required");
        }
        if (referRequest.getReferralOptionId() == null || referRequest.getReferralOptionId().trim().isEmpty()) {
            throw new VacademyException("Referral option ID is required");
        }
        if (refereeUser == null || refereeUser.getId() == null) {
            throw new VacademyException("Referee user is required");
        }
        if (referRequest.getReferrerUserId().equals(refereeUser.getId())) {
            throw new VacademyException("Referrer and referee cannot be the same user");
        }
    }

    private ReferralMapping createReferralMapping(ReferRequestDTO referRequest, UserPlan userPlan,
            ReferralOption referralOption) {
        return ReferralMapping.builder()
                .referrerUserId(referRequest.getReferrerUserId())
                .refereeUserId(userPlan.getUserId())
                .referralCode(referRequest.getReferralCode())
                .userPlan(userPlan)
                .status(getReferralMappingStatus(userPlan))
                .referralOption(referralOption)
                .build();
    }

    private String getReferralMappingStatus(UserPlan userPlan) {
        String type = userPlan.getPaymentOption().getType();

        switch (type) {
            case "FREE":
                return ReferralStatusEnum.ACTIVE.name();
            case "DONATION":
                return ReferralStatusEnum.ACTIVE.name();
            case "ONE_TIME":
                return ReferralStatusEnum.PENDING.name();
            case "SUBSCRIPTION":
                return ReferralStatusEnum.PENDING.name();
            default:
                throw new VacademyException("Not a valid payment option type");
        }
    }

    private void processRefereeBenefits(ReferralOption referralOption,
                                        ReferralMapping referralMapping,
                                        UserPlan userPlan,
                                        UserDTO refereeUser,
                                        PaymentInitiationRequestDTO paymentInitiationRequestDTO,
                                        List<PaymentLogLineItemDTO> paymentLineItems,
                                        List<ReferralBenefitLogs> allBenefitLogs) {

        if (referralOption.getRefereeDiscountJson() == null) {
            return;
        }

        try {
            JsonNode refereeBenefitNode = objectMapper.readTree(referralOption.getRefereeDiscountJson());
            String benefitType = refereeBenefitNode.get("benefitType").asText();

            ReferralBenefitHandler handler = getBenefitHandler(benefitType);
            if (handler == null) {
                throw new VacademyException("Not a valid benefit type");
            }

            List<ReferralBenefitLogs> benefitLogs = handler.processBenefit(
                    referralOption.getRefereeDiscountJson(),
                    referralMapping,
                    referralOption,
                    userPlan,
                refereeUser,
                ReferralBenefitLogsBeneficiary.REFEREE.name(),getReferralMappingStatus(userPlan));

            allBenefitLogs.addAll(benefitLogs);

            PaymentLogLineItemDTO lineItem = handler.calculateDiscount(referralOption.getRefereeDiscountJson(),
                    paymentInitiationRequestDTO);
            if (lineItem != null) {
                paymentLineItems.add(lineItem);
            }

        } catch (Exception e) {
            throw new VacademyException("Failed to process referee benefits: " + e.getMessage());
        }
    }

    private void processReferrerBenefits(ReferralOption referralOption,
            ReferralMapping referralMapping,
            UserPlan userPlan,
            UserDTO referrerUser,
            List<ReferralBenefitLogs> allBenefitLogs) {

        if (referralOption.getReferrerDiscountJson() == null) {
            return;
        }

        try {
            JsonNode referrerBenefitNode = objectMapper.readTree(referralOption.getReferrerDiscountJson());
            String benefitType = referrerBenefitNode.get("benefitType").asText();

            if (isMonetaryBenefit(benefitType)) {
                return;
            }

            ReferralBenefitHandler handler = getBenefitHandler(benefitType);
            if (handler == null) {
                return;
            }


            List<ReferralBenefitLogs> benefitLogs = handler.processBenefit(
                    referralOption.getReferrerDiscountJson(),
                    referralMapping,
                    referralOption,
                    userPlan,
                    referrerUser,
                    ReferralBenefitLogsBeneficiary.REFERRER.name(),
                    getReferralMappingStatus(userPlan));

            allBenefitLogs.addAll(benefitLogs);

        } catch (Exception e) {
            throw new VacademyException("Failed to process referrer benefits: " + e.getMessage());
        }
    }

    private ReferralBenefitHandler getBenefitHandler(String benefitType) {
        for (var referralHandler:benefitHandlers){
            if (referralHandler.supports(benefitType)){
                return referralHandler;
            }
        }
        return null;
    }

    private boolean isMonetaryBenefit(String benefitType) {
        return "DISCOUNT_FLAT".equals(benefitType) || "DISCOUNT_PERCENTAGE".equals(benefitType);
    }


    public List<ReferralBenefitLogs> getBenefitLogsByUserPlanId(String userPlanId) {
        return referralBenefitLogsRepository.findByUserPlanId(userPlanId);
    }

    @Transactional
    public void updateBenefitLogStatus(String benefitLogId, String status) {
        Optional<ReferralBenefitLogs> optionalLog = referralBenefitLogsRepository.findById(benefitLogId);
        if (optionalLog.isPresent()) {
            ReferralBenefitLogs log = optionalLog.get();
            log.setStatus(status);
            referralBenefitLogsRepository.save(log);
        }
    }

    @Transactional
    public void updateReferralMappingStatus(String referralMappingId, String status) {
        Optional<ReferralMapping> optionalMapping = referralMappingRepository.findById(referralMappingId);
        if (optionalMapping.isPresent()) {
            ReferralMapping mapping = optionalMapping.get();
            mapping.setStatus(status);
            referralMappingRepository.save(mapping);
        }
    }
}
