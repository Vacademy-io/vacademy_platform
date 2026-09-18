package vacademy.io.admin_core_service.features.enroll_invite.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.exceptions.EnrollmentConflictException;

import java.util.Map;

/**
 * Prevents a phone-identified account from submitting the same enrollment invite
 * more than once. This is deliberately independent of trial or payment settings.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PhoneIdentifierInviteSubmissionGuard {

    private static final String USER_IDENTIFIER_SETTING = "USER_IDENTIFIER";

    private final InstituteSettingService instituteSettingService;
    private final UserPlanRepository userPlanRepository;

    public void validateNotAlreadySubmitted(EnrollInvite enrollInvite, String userId, String instituteId) {
        if (enrollInvite == null
                || !StringUtils.hasText(enrollInvite.getId())
                || !StringUtils.hasText(userId)
                || !StringUtils.hasText(instituteId)
                || !usesPhoneIdentifier(instituteId)) {
            return;
        }

        if (userPlanRepository.findFirstByUserIdAndEnrollInviteIdOrderByCreatedAtDesc(
                userId, enrollInvite.getId()).isPresent()) {
            log.info("Blocking repeated phone-identifier invite submission: userId={}, instituteId={}, inviteId={}",
                    userId, instituteId, enrollInvite.getId());
            throw new EnrollmentConflictException(
                    EnrollmentConflictException.ConflictType.ALREADY_ENROLLED,
                    "This mobile number has already been used to submit this invite link. Please sign in to continue.");
        }
    }

    private boolean usesPhoneIdentifier(String instituteId) {
        Object setting = instituteSettingService.getSettingByInstituteIdAndKey(
                instituteId, USER_IDENTIFIER_SETTING);
        if (setting instanceof Map<?, ?> map) {
            Object value = map.containsKey("userIdentifier")
                    ? map.get("userIdentifier")
                    : map.containsKey("user_identifier")
                            ? map.get("user_identifier")
                            : map.get("value");
            return value != null && "PHONE".equalsIgnoreCase(value.toString());
        }
        return setting != null && "PHONE".equalsIgnoreCase(setting.toString());
    }
}
