package vacademy.io.admin_core_service.features.enroll_invite.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.exceptions.EnrollmentConflictException;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Prevents a phone-identified account from enrolling in the same course twice.
 *
 * <p>Scope is the COURSE (package session), not the invite link. An institute usually
 * has several links into one batch — monthly / quarterly / annual — and keying on
 * the link alone let a learner whose trial had ended (or whose autopay had failed)
 * take a fresh free trial through a sibling link, superseding their real plan. Two
 * checks, either one blocks:
 * <ol>
 *   <li>the account already holds a plan on THIS invite (the original rule);</li>
 *   <li>the account already holds a plan on ANY invite that lands in one of this
 *       invite's package sessions.</li>
 * </ol>
 * The learner is told to sign in: the dashboard offers "Pay to continue" for a
 * plan whose payment failed or whose mandate is gone, so nothing is lost by
 * refusing the form. Deliberately independent of trial or payment settings.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PhoneIdentifierInviteSubmissionGuard {

    private static final String USER_IDENTIFIER_SETTING = "USER_IDENTIFIER";

    private final InstituteSettingService instituteSettingService;
    private final UserPlanRepository userPlanRepository;
    private final PackageSessionLearnerInvitationToPaymentOptionRepository inviteMappingRepository;

    private static final String ALREADY_ENROLLED_MESSAGE =
            "This mobile number is already registered for this course. Please sign in to continue — "
            + "you can renew or complete your payment from your dashboard.";

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
                    EnrollmentConflictException.ConflictType.ALREADY_ENROLLED, ALREADY_ENROLLED_MESSAGE);
        }

        List<String> packageSessionIds = inviteMappingRepository
                .findByEnrollInviteIdAndStatusWithPackageSession(enrollInvite.getId(), List.of("ACTIVE"))
                .stream()
                .map(PackageSessionLearnerInvitationToPaymentOption::getPackageSession)
                .filter(Objects::nonNull)
                .map(ps -> ps.getId())
                .distinct()
                .toList();
        if (!packageSessionIds.isEmpty()
                && userPlanRepository.existsByUserIdAndPackageSessionIds(userId, packageSessionIds)) {
            log.info("Blocking phone-identifier enrolment via sibling invite: userId={}, instituteId={}, inviteId={}, packageSessions={}",
                    userId, instituteId, enrollInvite.getId(), packageSessionIds);
            throw new EnrollmentConflictException(
                    EnrollmentConflictException.ConflictType.ALREADY_ENROLLED, ALREADY_ENROLLED_MESSAGE);
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
