package vacademy.io.admin_core_service.features.user_subscription.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralDetailDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitLogsBeneficiary;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.ReferralMappingRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReferralMappingService {

    private final ReferralMappingRepository referralMappingRepository;


    private final ReferralBenefitLogService referralBenefitLogService;

    private final AuthService authService;

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

    public List<ReferralDetailDTO> findReferralDetailForBeneficiary(String beneficiary,String userId, CustomUserDetails userDetails) {
        // Step 1: Get valid referral mappings
        List<ReferralMapping> referralMappings = getReferralMappings(beneficiary, userId);

        if (referralMappings.isEmpty()) {
            return Collections.emptyList();
        }

        // Step 2: Get user details in bulk
        Map<String, UserDTO> userMap = getTargetUsersForMappings(referralMappings, beneficiary);

        // Step 3: Build DTOs
        return buildReferralDetailDTOs(referralMappings, beneficiary, userId, userMap);
    }

    private List<ReferralMapping> getReferralMappings(String beneficiary, String currentUserId) {
        List<String> validStatuses = List.of(
                ReferralStatusEnum.PENDING.name(),
                ReferralStatusEnum.ACTIVE.name()
        );

        if (ReferralBenefitLogsBeneficiary.REFERRER.name().equalsIgnoreCase(beneficiary)) {
            return referralMappingRepository
                    .findByReferrerUserIdAndStatusInOrderByCreatedAtDesc(currentUserId, validStatuses);
        } else {
            return referralMappingRepository
                    .findByRefereeUserIdAndStatusInOrderByCreatedAtDesc(currentUserId, validStatuses);
        }
    }

    private Map<String, UserDTO> getTargetUsersForMappings(List<ReferralMapping> mappings, String beneficiary) {
        Set<String> targetUserIds = mappings.stream()
                .map(mapping -> ReferralBenefitLogsBeneficiary.REFERRER.name().equalsIgnoreCase(beneficiary)
                        ? mapping.getRefereeUserId()
                        : mapping.getReferrerUserId())
                .collect(Collectors.toSet());

        List<UserDTO> users = getUsersFromAuthServiceByUserIds(new ArrayList<>(targetUserIds));

        return users.stream()
                .collect(Collectors.toMap(UserDTO::getId, u -> u));
    }

    private List<ReferralDetailDTO> buildReferralDetailDTOs(
            List<ReferralMapping> referralMappings,
            String beneficiary,
            String currentUserId,
            Map<String, UserDTO> userMap
    ) {
        List<String> benefitLogStatuses = List.of(
                ReferralStatusEnum.PENDING.name(),
                ReferralStatusEnum.ACTIVE.name()
        );

        List<ReferralDetailDTO> referralDetailDTOS = new ArrayList<>();

        for (ReferralMapping referralMapping : referralMappings) {
            String targetUserId = ReferralBenefitLogsBeneficiary.REFERRER.name().equalsIgnoreCase(beneficiary)
                    ? referralMapping.getRefereeUserId()
                    : referralMapping.getReferrerUserId();

            UserDTO userDTO = userMap.get(targetUserId);

            ReferralDetailDTO dto = new ReferralDetailDTO();
            dto.setUserDetail(userDTO);
            dto.setCouponCode(referralMapping.getReferralCode());
            dto.setStatus(referralMapping.getStatus());
            dto.setReferralMappingId(referralMapping.getId());
            dto.setBenefitLogs(
                    referralBenefitLogService
                            .getReferralBenefitLogsByUserIdAndReferralMappingIdAndBeneficiaryAndStatusInOrderByCreatedAtDesc(
                                    currentUserId,
                                    referralMapping.getId(),
                                    beneficiary,
                                    benefitLogStatuses
                            )
            );

            referralDetailDTOS.add(dto);
        }

        return referralDetailDTOS;
    }

    private List<UserDTO> getUsersFromAuthServiceByUserIds(List<String> userIds) {
        return authService.getUsersFromAuthServiceByUserIds(userIds);
    }
}
