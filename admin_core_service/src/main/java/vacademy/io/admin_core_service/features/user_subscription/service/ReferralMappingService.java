package vacademy.io.admin_core_service.features.user_subscription.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.ReferralMappingRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ReferralMappingService {

    private final ReferralMappingRepository referralMappingRepository;


    private ReferralBenefitLogService referralBenefitLogService;

    public ReferralMapping createMapping(String referrerUserId,
                                         String refereeUserId,
                                         String referralCode,
                                         UserPlan userPlan,
                                         String status,
                                         ReferralOption referralOption) {
        ReferralMapping mapping = ReferralMapping.builder()
                .referrerUserId(referrerUserId)
                .refereeUserId(refereeUserId)
                .referralCode(referralCode)
                .userPlan(userPlan)
                .status(status)
                .referralOption(referralOption)
                .build();
        return referralMappingRepository.save(mapping);
    }

    public Optional<ReferralMapping> getMappingById(String id) {
        return referralMappingRepository.findById(id);
    }

    public List<ReferralMapping> getAllMappings() {
        return referralMappingRepository.findAll();
    }

    public ReferralMapping updateMapping(String id,
                                         String referrerUserId,
                                         String refereeUserId,
                                         String referralCode,
                                         UserPlan userPlan,
                                         String status,
                                         ReferralOption referralOption) {
        return referralMappingRepository.findById(id)
                .map(existing -> {
                    existing.setReferrerUserId(referrerUserId);
                    existing.setRefereeUserId(refereeUserId);
                    existing.setReferralCode(referralCode);
                    existing.setUserPlan(userPlan);
                    existing.setStatus(status);
                    existing.setReferralOption(referralOption);
                    return referralMappingRepository.save(existing);
                })
                .orElseThrow(() -> new VacademyException("Mapping not found with id " + id));
    }

    public void deleteMapping(String id) {
        referralMappingRepository.deleteById(id);
    }

    public void processReferralBenefitsIfApplicable(UserPlan userPlan){
        Optional<ReferralMapping>optionalReferralMapping = referralMappingRepository.findByUserPlanIdAndStatusIn(userPlan.getId(),List.of(ReferralStatusEnum.PENDING.name()));
        if (optionalReferralMapping.isPresent()){
            ReferralMapping referralMapping = optionalReferralMapping.get();
            referralBenefitLogService.updateStatusAndProcessBenefits(userPlan,optionalReferralMapping.get());
            referralMapping.setStatus(ReferralStatusEnum.ACTIVE.name());
            referralMappingRepository.save(referralMapping);
        }
    }
}
