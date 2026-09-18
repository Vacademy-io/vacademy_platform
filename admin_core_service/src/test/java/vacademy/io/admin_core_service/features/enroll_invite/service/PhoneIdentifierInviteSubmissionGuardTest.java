package vacademy.io.admin_core_service.features.enroll_invite.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.exceptions.EnrollmentConflictException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PhoneIdentifierInviteSubmissionGuardTest {

    @Mock
    private InstituteSettingService instituteSettingService;

    @Mock
    private UserPlanRepository userPlanRepository;

    private PhoneIdentifierInviteSubmissionGuard service() {
        return new PhoneIdentifierInviteSubmissionGuard(instituteSettingService, userPlanRepository);
    }

    @Test
    void samePhoneAccountAndSameInviteAreRejected() {
        EnrollInvite invite = invite();
        when(instituteSettingService.getSettingByInstituteIdAndKey("inst-1", "USER_IDENTIFIER"))
                .thenReturn("PHONE");
        when(userPlanRepository.findFirstByUserIdAndEnrollInviteIdOrderByCreatedAtDesc("user-1", "invite-1"))
                .thenReturn(Optional.of(new UserPlan()));

        EnrollmentConflictException error = assertThrows(
                EnrollmentConflictException.class,
                () -> service().validateNotAlreadySubmitted(invite, "user-1", "inst-1"));

        assertEquals(EnrollmentConflictException.ConflictType.ALREADY_ENROLLED,
                error.getConflictType());
    }

    @Test
    void firstSubmissionForPhoneAccountIsAllowed() {
        EnrollInvite invite = invite();
        when(instituteSettingService.getSettingByInstituteIdAndKey("inst-1", "USER_IDENTIFIER"))
                .thenReturn("PHONE");
        when(userPlanRepository.findFirstByUserIdAndEnrollInviteIdOrderByCreatedAtDesc("user-1", "invite-1"))
                .thenReturn(Optional.empty());

        assertDoesNotThrow(() -> service().validateNotAlreadySubmitted(invite, "user-1", "inst-1"));
    }

    @Test
    void emailIdentifierInstitutesKeepExistingBehavior() {
        when(instituteSettingService.getSettingByInstituteIdAndKey("inst-1", "USER_IDENTIFIER"))
                .thenReturn("EMAIL");

        assertDoesNotThrow(() -> service().validateNotAlreadySubmitted(invite(), "user-1", "inst-1"));
        verifyNoInteractions(userPlanRepository);
    }

    private EnrollInvite invite() {
        EnrollInvite invite = new EnrollInvite();
        invite.setId("invite-1");
        return invite;
    }
}
