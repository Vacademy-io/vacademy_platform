package vacademy.io.admin_core_service.features.user_subscription.handler;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.service.PackageSessionEnrollInviteToPaymentOptionService;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.user_subscription.dto.BenefitConfigDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitLogsBeneficiary;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitType;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralBenefitLogService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Calendar;
import java.util.Date;
import java.util.List;

@Component
public class MemberShipBenefit extends AbstractReferralProcessableBenefit {

    @Autowired
    private StudentSessionInstituteGroupMappingRepository studentSessionInstituteGroupMappingRepository;

    @Autowired
    @Lazy
    private ReferralBenefitLogService referralBenefitLogService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PackageSessionEnrollInviteToPaymentOptionService packageSessionEnrollInviteToPaymentOptionService;

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
            // 1. Cast the generic benefit value to the specific type for membership extension.
            BenefitConfigDTO.MembershipExtensionValue membershipValue = objectMapper.convertValue(benefitDTO.getValue(), BenefitConfigDTO.MembershipExtensionValue.class);
            int daysToExtend = membershipValue.getDays();

            // 2. Determine who receives the benefit.
            boolean isForReferee = beneficiary.equalsIgnoreCase(ReferralBenefitLogsBeneficiary.REFEREE.name());
            UserDTO targetUser = isForReferee ? refereeUser : referrer;

            // 3. Get the package session IDs to extend from the enrollment DTO.
            List<String> packageSessionIds = learnerPackageSessionsEnrollDTO.getPackageSessionIds();

            if (status.equalsIgnoreCase(ReferralStatusEnum.ACTIVE.name())){
                // 4. Call the method to perform the membership extension.
                extendMemberShipDaysOfLearner(targetUser.getId(), packageSessionIds, daysToExtend);
            }

            // 5. Create a log entry for this action.
            referralBenefitLogService.createLog(
                    referralMapping.getUserPlan(),
                    referralMapping,
                    targetUser.getId(),
                    ReferralBenefitType.FREE_MEMBERSHIP_DAYS.name(),
                    beneficiary,
                    objectMapper.writeValueAsString(membershipValue), // Log the specific benefit value
                    status
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to process membership extension benefit", e);
        }
    }

    @Override
    public void processPendingBenefit(String benefitJson, String beneficiary, ReferralMapping referralMapping, UserDTO referee, UserDTO referrer, String instituteId) {
        try {
            BenefitConfigDTO.MembershipExtensionValue membershipValue =
                    objectMapper.readValue(benefitJson, BenefitConfigDTO.MembershipExtensionValue.class);

            int daysToExtend = membershipValue.getDays();

            EnrollInvite enrollInvite = referralMapping.getUserPlan().getEnrollInvite();
            List<String> packageSessionIds = packageSessionEnrollInviteToPaymentOptionService.findPackageSessionsOfEnrollInvite(enrollInvite);

            boolean isForReferee = beneficiary.equalsIgnoreCase(ReferralBenefitLogsBeneficiary.REFEREE.name());
            UserDTO targetUser = isForReferee ? referee : referrer;

            extendMemberShipDaysOfLearner(targetUser.getId(), packageSessionIds, daysToExtend);

        } catch (JsonProcessingException e) {
            e.printStackTrace();
            // handle error
            throw new VacademyException(e.getMessage());
        }

    }

    /**
     * Finds active student mappings and extends their expiry date.
     */
    private void extendMemberShipDaysOfLearner(String userId, List<String> packageSessionIds, int days) {
        if (packageSessionIds == null || packageSessionIds.isEmpty()) {
            return; // Cannot extend if we don't know which sessions to extend.
        }

        List<StudentSessionInstituteGroupMapping> studentSessionInstituteGroupMappings =
                studentSessionInstituteGroupMappingRepository.findAllByUserIdAndPackageSessionIdsAndStatus(
                        userId,
                        packageSessionIds,
                        List.of(LearnerStatusEnum.ACTIVE.name())
                );

        if (studentSessionInstituteGroupMappings == null || studentSessionInstituteGroupMappings.isEmpty()) {
            return; // No active memberships to extend for these sessions.
        }

        Date now = new Date();
        Calendar calendar = Calendar.getInstance();

        for (StudentSessionInstituteGroupMapping mapping : studentSessionInstituteGroupMappings) {
            Date expiryDate = mapping.getExpiryDate();

            if (expiryDate == null || expiryDate.before(now)) {
                // If membership has expired or has no expiry, extend from the current date.
                calendar.setTime(now);
            } else {
                // Otherwise, extend from the existing expiry date.
                calendar.setTime(expiryDate);
            }

            calendar.add(Calendar.DAY_OF_YEAR, days);
            mapping.setExpiryDate(calendar.getTime());
        }

        studentSessionInstituteGroupMappingRepository.saveAll(studentSessionInstituteGroupMappings);
    }
}