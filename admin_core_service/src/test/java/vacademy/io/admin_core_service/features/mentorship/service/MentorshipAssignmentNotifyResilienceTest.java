package vacademy.io.admin_core_service.features.mentorship.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.repository.TemplateRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRepository;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

/**
 * Assigning a mentor must never fail because a message channel is misconfigured.
 *
 * <p>An institute that has never touched notification settings is the DEFAULT state, and
 * several channels legitimately break there: no announcement-settings row, no Firebase
 * credentials, no WhatsApp payment method. None of that is the admin's problem at the
 * moment they press "Assign" — the pairing is what they asked for, and a warning in the
 * logs is the right place for a dead channel.
 *
 * <p>This pins the swallow. {@code MentorAssignmentService} additionally defers the call
 * until after commit, so even an escaping exception could not roll the assignment back;
 * these tests cover the layer below that, where the failures actually originate.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MentorshipAssignmentNotifyResilienceTest {

    private static final String INSTITUTE = "inst-1";
    private static final String STUDENT = "stu-1";
    private static final String MENTOR_USER = "mentor-user-1";

    @Mock private NotificationService notificationService;
    @Mock private InstituteSettingService instituteSettingService;
    @Mock private MentorRepository mentorRepository;
    @Mock private AuthService authService;
    @Mock private InstituteRepository instituteRepository;
    @Mock private TemplateRepository templateRepository;
    @Mock private InstituteDomainRoutingRepository domainRoutingRepository;

    @InjectMocks private MentorshipNotificationService service;

    private void bothUsersResolve() {
        UserDTO student = new UserDTO();
        student.setId(STUDENT);
        student.setFullName("Riya Sharma");
        student.setEmail("riya@example.com");
        UserDTO mentor = new UserDTO();
        mentor.setId(MENTOR_USER);
        mentor.setFullName("Asha Nair");
        mentor.setEmail("asha@example.com");
        when(authService.getUsersFromAuthServiceByUserIds(anyList()))
                .thenReturn(List.of(student, mentor));
    }

    private void notifyAssignment() {
        service.notifyAssignment(INSTITUTE, STUDENT, MENTOR_USER, "Asha Nair");
    }

    @Test
    @DisplayName("an institute with no mentorship settings at all still assigns cleanly")
    void noSettingsConfigured() {
        when(instituteSettingService.getSettingByInstituteIdAndKey(anyString(), anyString()))
                .thenReturn(null);
        bothUsersResolve();
        assertDoesNotThrow(this::notifyAssignment);
    }

    @Test
    @DisplayName("a dead in-app announcement channel does not surface to the admin")
    void systemAlertBlowsUp() {
        when(instituteSettingService.getSettingByInstituteIdAndKey(anyString(), anyString()))
                .thenReturn(Map.of());
        bothUsersResolve();
        // The real-world shape: no announcement-settings row for the institute.
        doThrow(new RuntimeException("announcement settings not found"))
                .when(notificationService)
                .createSystemAlertAnnouncement(anyString(), anyList(), anyString(), anyString(),
                        anyString(), anyString(), anyString(), any());

        assertDoesNotThrow(this::notifyAssignment);
    }

    @Test
    @DisplayName("a dead push channel does not surface to the admin")
    void pushBlowsUp() {
        when(instituteSettingService.getSettingByInstituteIdAndKey(anyString(), anyString()))
                .thenReturn(Map.of());
        bothUsersResolve();
        // The real-world shape: settings.firebase is null, so FCM cannot be reached.
        doThrow(new RuntimeException("firebase config missing"))
                .when(notificationService)
                .sendPushViaUnified(anyString(), anyList(), anyString(), anyString(), any());

        assertDoesNotThrow(this::notifyAssignment);
    }

    @Test
    @DisplayName("an unreachable auth service does not stop the pairing either")
    void identityLookupBlowsUp() {
        when(instituteSettingService.getSettingByInstituteIdAndKey(anyString(), anyString()))
                .thenReturn(Map.of());
        when(authService.getUsersFromAuthServiceByUserIds(anyList()))
                .thenThrow(new RuntimeException("auth service unreachable"));

        assertDoesNotThrow(this::notifyAssignment);
    }

    @Test
    @DisplayName("every channel failing at once is still silent to the admin")
    void everythingBlowsUp() {
        when(instituteSettingService.getSettingByInstituteIdAndKey(anyString(), anyString()))
                .thenThrow(new RuntimeException("settings store down"));
        assertDoesNotThrow(this::notifyAssignment);
    }
}
