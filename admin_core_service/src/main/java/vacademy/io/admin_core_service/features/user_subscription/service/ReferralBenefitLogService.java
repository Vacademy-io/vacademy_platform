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
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitType;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.handler.AbstractReferralProcessableBenefit;
import vacademy.io.admin_core_service.features.user_subscription.handler.AbstractReferralProcessableBenefitFactory;
import vacademy.io.admin_core_service.features.user_subscription.handler.ContentBenefitProcessor;
import vacademy.io.admin_core_service.features.user_subscription.repository.ReferralBenefitLogsRepository;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReferralBenefitLogService {

    private final ReferralBenefitLogsRepository referralBenefitLogRepository;

    @Lazy
    private final AbstractReferralProcessableBenefitFactory referralProcessableBenefitFactory;

    @Lazy
    private final AbstractReferralProcessableBenefit  contentbenefitProcessor;

    private final AuthService authService;

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
        // Fetch users once to avoid multiple DB calls
        List<UserDTO>users = authService.getUsersFromAuthServiceByUserIds(List.of(referralMapping.getRefereeUserId(),referralMapping.getReferrerUserId()));
        UserDTO referrer = null;
        UserDTO referee = null;
        if(users.get(0).getId().equalsIgnoreCase(referralMapping.getReferrerUserId())){
            referrer = users.get(0);
            referee = users.get(1);
        }else{
            referrer = users.get(1);
            referee = users.get(0);
        }
        String instituteId = userPlan.getEnrollInvite().getInstituteId();

        // Find all benefits that were pending for this specific referral
        List<ReferralBenefitLogs> pendingLogs = referralBenefitLogRepository.findByReferralMappingIdAndStatusIn(referralMapping.getId(),List.of(ReferralStatusEnum.PENDING.name()));

        for (ReferralBenefitLogs log : pendingLogs) {
            processBasedOnBenefitType(log, instituteId, referrer, referee);
        }

        referralBenefitLogRepository.saveAll(pendingLogs);
    }

    private void processBasedOnBenefitType(
            ReferralBenefitLogs log,
            String instituteId,
            UserDTO referrer,
            UserDTO referee
    ) {
        ReferralBenefitType benefitType;
        try {
            benefitType = ReferralBenefitType.valueOf(log.getBenefitType());
        } catch (IllegalArgumentException | NullPointerException e) {
            return;
        }

        switch (benefitType) {
            case FLAT_DISCOUNT:
            case PERCENTAGE_DISCOUNT:
            case POINTS:
                // These benefits are applied at payment time.
                // Just mark as ACTIVE since they're already handled.
                log.setStatus(ReferralStatusEnum.ACTIVE.name());
                break;

            case CONTENT:
            case MEMBERSHIP_EXTENSION:
                // Get processor dynamically based on type
                AbstractReferralProcessableBenefit contentBenefitProcessor =
                        referralProcessableBenefitFactory.getProcessor(log.getBenefitType());

                if (contentBenefitProcessor != null) {
                    contentBenefitProcessor.processPendingBenefit(
                            log.getBenefitValue(),
                            log.getBeneficiary(),
                            log.getReferralMapping(),
                            referee,
                            referrer,
                            instituteId
                    );
                    log.setStatus(ReferralStatusEnum.ACTIVE.name());
                }
                break;

            default:
                break;
        }
    }

    public List<ReferralBenefitLogs>findByUserIdAndBenefitTypeAndStatusIn(String userId, String benefitType, List<String> statusList){
        return referralBenefitLogRepository.findByUserIdAndBenefitTypeAndStatusIn(userId,benefitType,statusList);
    }

    public List<ReferralBenefitLogDTO>getReferralBenefitLogsByUserIdAndReferralMappingIdAndBeneficiaryAndStatusInOrderByCreatedAtDesc(String userId, String referralMappingId, String beneficiary, List<String> statusList){
        return referralBenefitLogRepository.findByUserIdAndReferralMappingIdAndBeneficiaryAndStatusInOrderByCreatedAtDesc(userId,referralMappingId,beneficiary,statusList).stream().map(ReferralBenefitLogs::mapToDTO).collect(Collectors.toList());
    }

    public List<ReferralBenefitLogDTO>getReferralBenefitLogsByUserIdAndReferralMappingIdAndBeneficiaryAndStatusInOrderByCreatedAtDesc(String userId,String beneficiary, List<String> statusList){
        return referralBenefitLogRepository.findByUserIdAndBeneficiaryAndStatusInOrderByCreatedAtDesc(userId,beneficiary,statusList).stream().map(ReferralBenefitLogs::mapToDTO).collect(Collectors.toList());
    }

    public long getPointsCount(String userId){
        List<ReferralBenefitLogs>referralBenefitLogs = findByUserIdAndBenefitTypeAndStatusIn(userId,ReferralBenefitType.POINTS.name(),List.of(ReferralStatusEnum.ACTIVE.name()));
        return getPointsCount(referralBenefitLogs);
    }
    private long getPointsCount(List<ReferralBenefitLogs> referralBenefitLogs) {
        if (referralBenefitLogs == null || referralBenefitLogs.isEmpty()) {
            return 0;
        }

        return referralBenefitLogs.stream()
                .map(log -> JsonUtil.fromJson(log.getBenefitValue(), BenefitConfigDTO.PointBenefitValue.class))
                .filter(Objects::nonNull) // avoid NPE
                .mapToLong(BenefitConfigDTO.PointBenefitValue::getPoints)
                .sum();
    }

}