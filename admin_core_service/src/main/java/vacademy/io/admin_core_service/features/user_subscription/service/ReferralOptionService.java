package vacademy.io.admin_core_service.features.user_subscription.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.dto.CouponVerificationRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.CouponVerificationResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralOptionSettingDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.enums.CouponCodeSource;
import vacademy.io.admin_core_service.features.user_subscription.repository.CouponCodeRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.ReferralOptionRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;

import java.util.List;
import java.util.Optional;

@Service
public class ReferralOptionService {
    @Autowired
    private ReferralOptionRepository referralOptionRepository;

    @Autowired
    private CouponCodeRepository couponCodeRepository;

    @Autowired
    private StudentSessionInstituteGroupMappingRepository studentSessionMappingRepository;

    @Autowired
    private ObjectMapper objectMapper;

    public String addReferralOption(ReferralOptionDTO referralOptionDTO) {
        ReferralOption referralOption = new ReferralOption(referralOptionDTO);
        referralOptionRepository.save(referralOption);
        return "Referral option added successfully";
    }

    public String deleteReferralOptions(List<String> referralOptionIds) {
        List<ReferralOption>referralOptions = referralOptionRepository.findAllById(referralOptionIds);
        for (ReferralOption referralOption : referralOptions) {
            referralOption.setStatus(StatusEnum.DELETED.name());
        }
        referralOptionRepository.saveAll(referralOptions);
        return "Referral options deleted successfully";
    }

    public List<ReferralOptionDTO> getReferralOptions(String source, String sourceId) {
        List<ReferralOption>referralOptions = referralOptionRepository.findBySourceAndSourceIdAndStatusIn(source,sourceId,List.of(StatusEnum.ACTIVE.name()));
        return referralOptions.stream().map(ReferralOption::toReferralOptionDTO).toList();
    }


    public Optional<ReferralOption> getReferralOptionBySourceAndSourceIdAndTag(String source, String sourceId, String tag) {
        return referralOptionRepository.findFirstBySourceAndSourceIdAndTagAndStatusInOrderByCreatedAtDesc(source, sourceId, tag,List.of(StatusEnum.ACTIVE.name()));
    }

    public Optional<ReferralOption> findById(String id){
        return referralOptionRepository.findById(id);
    }

    ///  to do:: here we need to vefiy wtheter that coupon code belongs to same isutute for that package session
    public CouponVerificationResponseDTO verifyCouponCode(
        String couponCode,
        String referralOptionId,
        CouponVerificationRequestDTO request) {
        try {
            CouponCode coupon = validateCouponCode(couponCode);
            if (coupon == null) {
                return buildFailureResponse("Invalid coupon code or source type");
            }

            Optional<ReferralOption> referralOption = getReferralOption(referralOptionId);
            if (referralOption.isEmpty()) {
                return buildFailureResponse("Referral option not found");
            }

            ReferralOptionSettingDTO settingDTO = parseReferralOptionSettings(referralOption.get());
            if (settingDTO == null) {
                settingDTO = new ReferralOptionSettingDTO();
                settingDTO.setAllowAnyPackageSessionLearnerReferral(true);
            }

            if (settingDTO.isAllowAnyPackageSessionLearnerReferral()) {
                return buildSuccessResponse(coupon, "Coupon code verified successfully");
            }

            if (!hasValidPackageSessions(request)) {
                return buildFailureResponse("No package session IDs provided");
            }

            if (hasActiveSession(coupon.getSourceId(), request.getPackageSessionId())) {
                return buildSuccessResponse(coupon, "Coupon code verified successfully");
            }

            return buildFailureResponse("User does not have active status in any of the specified package sessions");

        } catch (Exception e) {
            return buildFailureResponse("Error verifying coupon code: " + e.getMessage());
        }
    }

    private CouponCode validateCouponCode(String couponCode) {
        Optional<CouponCode> couponCodeOpt = couponCodeRepository.findByCode(couponCode);
        if (couponCodeOpt.isEmpty()) return null;

        CouponCode coupon = couponCodeOpt.get();
        if (!CouponCodeSource.USER.name().equals(coupon.getSourceType())) return null;

        return coupon;
    }

    public Optional<ReferralOption> getReferralOption(String referralOptionId) {
        return referralOptionRepository.findById(referralOptionId);
    }

    private ReferralOptionSettingDTO parseReferralOptionSettings(ReferralOption referralOption) {
        try {
            if (referralOption.getSettingJson() != null && !referralOption.getSettingJson().isEmpty()) {
                return objectMapper.readValue(referralOption.getSettingJson(), ReferralOptionSettingDTO.class);
            }
            return new ReferralOptionSettingDTO();
        } catch (Exception e) {
            return null;
        }
    }

    private boolean hasValidPackageSessions(CouponVerificationRequestDTO request) {
        List<String> packageSessionIds = request.getPackageSessionId();
        return packageSessionIds != null && !packageSessionIds.isEmpty();
    }

    private boolean hasActiveSession(String learnerId, List<String> packageSessionIds) {
        return studentSessionMappingRepository
            .existsByUserIdAndStatusInAndPackageSessionIdIn(
                learnerId,
                List.of(LearnerStatusEnum.ACTIVE.name()),
                packageSessionIds
            );
    }

    private CouponVerificationResponseDTO buildSuccessResponse(CouponCode coupon, String message) {
        return CouponVerificationResponseDTO.builder()
            .verified(true)
            .sourceType(coupon.getSourceType())
            .sourceId(coupon.getSourceId())
            .message(message)
            .build();
    }

    private CouponVerificationResponseDTO buildFailureResponse(String message) {
        return CouponVerificationResponseDTO.builder()
            .verified(false)
            .message(message)
            .build();
    }
}
