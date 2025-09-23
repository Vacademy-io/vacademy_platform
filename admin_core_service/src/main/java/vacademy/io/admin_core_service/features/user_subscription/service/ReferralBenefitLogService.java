package vacademy.io.admin_core_service.features.user_subscription.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.user_subscription.dto.BenefitConfigDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralBenefitLogDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralBenefitLogs;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitLogsBeneficiary;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitType;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.handler.AbstractReferralProcessableBenefit;
import vacademy.io.admin_core_service.features.user_subscription.handler.AbstractReferralProcessableBenefitFactory;
import vacademy.io.admin_core_service.features.user_subscription.repository.ReferralBenefitLogsRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;


import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReferralBenefitLogService {

    private final ReferralBenefitLogsRepository referralBenefitLogRepository;
    private final AuthService authService;
    private final MultiChannelDeliveryService multiChannelDeliveryService;

    @Lazy
    private final AbstractReferralProcessableBenefitFactory referralProcessableBenefitFactory;

    public ReferralBenefitLogs createLog(UserPlan userPlan,
                                         ReferralMapping referralMapping,
                                         String userId,
                                         String benefitType,
                                         String beneficiary,
                                         String benefitValue,
                                         String status) {
        ReferralBenefitLogs log = ReferralBenefitLogs.builder()
                .userPlan(userPlan)
                .referralMapping(referralMapping)
                .userId(userId)
                .benefitType(benefitType)
                .beneficiary(beneficiary)
                .benefitValue(benefitValue)
                .status(status)
                .build();
        return referralBenefitLogRepository.save(log);
    }

    public Optional<ReferralBenefitLogs> getLogById(String id) {
        return referralBenefitLogRepository.findById(id);
    }

    public void deleteLog(String id) {
        referralBenefitLogRepository.deleteById(id);
    }

    @Transactional
    public void updateStatusAndProcessBenefits(UserPlan userPlan, ReferralMapping referralMapping) {
        List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(referralMapping.getRefereeUserId(), referralMapping.getReferrerUserId()));
        UserDTO referrer;
        UserDTO referee;
        if (users.get(0).getId().equalsIgnoreCase(referralMapping.getReferrerUserId())) {
            referrer = users.get(0);
            referee = users.get(1);
        } else {
            referrer = users.get(1);
            referee = users.get(0);
        }
        String instituteId = userPlan.getEnrollInvite().getInstituteId();

        List<ReferralBenefitLogs> pendingLogs = referralBenefitLogRepository.findByReferralMappingIdAndStatusIn(referralMapping.getId(), List.of(ReferralStatusEnum.PENDING.name()));

        for (ReferralBenefitLogs log : pendingLogs) {
            processBasedOnBenefitType(log, instituteId, referrer, referee, referralMapping);
        }

        referralBenefitLogRepository.saveAll(pendingLogs);
    }

    private void processBasedOnBenefitType(
            ReferralBenefitLogs log,
            String instituteId,
            UserDTO referrer,
            UserDTO referee,
            ReferralMapping referralMapping
    ) {
        ReferralBenefitType benefitType;
        try {
            benefitType = ReferralBenefitType.valueOf(log.getBenefitType());
        } catch (IllegalArgumentException | NullPointerException e) {
            // Log error or handle unknown benefit type
            return;
        }

        boolean isForReferee = log.getBeneficiary().equalsIgnoreCase(ReferralBenefitLogsBeneficiary.REFEREE.name());

        switch (benefitType) {
            case FLAT_DISCOUNT, PERCENTAGE_DISCOUNT, POINTS -> {
                // These benefits were pending. Now we activate them and send a notification.
                Object benefitValue = deserializeBenefitValue(log.getBenefitValue(), benefitType);
                if (benefitValue != null) {
                    multiChannelDeliveryService.sendReferralNotification(
                            referrer,
                            referee,
                            benefitValue,
                            benefitType,
                            instituteId,
                            referralMapping,
                            isForReferee
                    );
                }
                log.setStatus(ReferralStatusEnum.ACTIVE.name());
            }

            case CONTENT, FREE_MEMBERSHIP_DAYS -> {
                // These benefits have their own processing logic which includes sending notifications.
                AbstractReferralProcessableBenefit processor = referralProcessableBenefitFactory.getProcessor(log.getBenefitType());
                if (processor != null) {
                    processor.processPendingBenefit(
                            log.getBenefitValue(),
                            log.getBeneficiary(),
                            log.getReferralMapping(),
                            referee,
                            referrer,
                            instituteId
                    );
                    log.setStatus(ReferralStatusEnum.ACTIVE.name());
                } else {
                    throw new VacademyException("No processor found for benefit type " + log.getBenefitType());
                }
            }
            default -> {
                // Handle unknown or unhandled benefit types
            }
        }
    }

    private Object deserializeBenefitValue(String benefitJson, ReferralBenefitType type) {
        return switch (type) {
            case POINTS -> JsonUtil.fromJson(benefitJson, BenefitConfigDTO.PointBenefitValue.class);
            case FLAT_DISCOUNT -> JsonUtil.fromJson(benefitJson, BenefitConfigDTO.FlatDiscountValue.class);
            case PERCENTAGE_DISCOUNT -> JsonUtil.fromJson(benefitJson, BenefitConfigDTO.PercentageDiscountValue.class);
            default -> null;
        };
    }

    public List<ReferralBenefitLogs> findByUserIdAndBenefitTypeAndStatusIn(String userId, String benefitType, List<String> statusList) {
        return referralBenefitLogRepository.findByUserIdAndBenefitTypeAndStatusIn(userId, benefitType, statusList);
    }

    public List<ReferralBenefitLogDTO> getReferralBenefitLogsByUserIdAndReferralMappingIdAndBeneficiaryAndStatusInOrderByCreatedAtDesc(String userId, String referralMappingId, String beneficiary, List<String> statusList) {
        return referralBenefitLogRepository.findByUserIdAndReferralMappingIdAndBeneficiaryAndStatusInOrderByCreatedAtDesc(userId, referralMappingId, beneficiary, statusList).stream().map(ReferralBenefitLogs::mapToDTO).collect(Collectors.toList());
    }

    public List<ReferralBenefitLogDTO> getReferralBenefitLogsByUserIdAndReferralMappingIdAndBeneficiaryAndStatusInOrderByCreatedAtDesc(String userId, String beneficiary, List<String> statusList) {
        return referralBenefitLogRepository.findByUserIdAndBeneficiaryAndStatusInOrderByCreatedAtDesc(userId, beneficiary, statusList).stream().map(ReferralBenefitLogs::mapToDTO).collect(Collectors.toList());
    }

    public long getPointsCount(String userId) {
        List<ReferralBenefitLogs> referralBenefitLogs = findByUserIdAndBenefitTypeAndStatusIn(userId, ReferralBenefitType.POINTS.name(), List.of(ReferralStatusEnum.ACTIVE.name()));
        return getPointsCount(referralBenefitLogs);
    }

    private long getPointsCount(List<ReferralBenefitLogs> referralBenefitLogs) {
        if (referralBenefitLogs == null || referralBenefitLogs.isEmpty()) {
            return 0;
        }
        return referralBenefitLogs.stream()
                .map(log -> JsonUtil.fromJson(log.getBenefitValue(), BenefitConfigDTO.PointBenefitValue.class))
                .filter(Objects::nonNull)
                .mapToLong(BenefitConfigDTO.PointBenefitValue::getPoints)
                .sum();
    }
}