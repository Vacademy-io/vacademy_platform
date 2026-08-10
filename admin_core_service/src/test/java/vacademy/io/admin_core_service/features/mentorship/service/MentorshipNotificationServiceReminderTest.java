package vacademy.io.admin_core_service.features.mentorship.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.repository.TemplateRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Config parsing + delivery edge cases for the two scheduler-driven mentorship
 * triggers: clamped numeric config, master-flag defaults (reminder ON,
 * check-in OFF), placeholder substitution, and the template-resolution chain
 * falling back from DB rows to inline defaults.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MentorshipNotificationServiceReminderTest {

    private static final String INSTITUTE = "inst-1";
    private static final String SETTING_KEY = "MENTORSHIP_SETTING";

    @Mock private NotificationService notificationService;
    @Mock private InstituteSettingService instituteSettingService;
    @Mock private MentorRepository mentorRepository;
    @Mock private AuthService authService;
    @Mock private InstituteRepository instituteRepository;
    @Mock private TemplateRepository templateRepository;
    @Mock private InstituteDomainRoutingRepository domainRoutingRepository;

    @InjectMocks private MentorshipNotificationService service;

    private void settingBlob(String triggerKey, Map<String, Object> section) {
        Map<String, Object> blob = new HashMap<>();
        blob.put(triggerKey, section);
        when(instituteSettingService.getSettingByInstituteIdAndKey(INSTITUTE, SETTING_KEY))
                .thenReturn(blob);
    }

    // -------------------------------------------------------------- config parsing

    @Test
    @DisplayName("hours_before: absent → 24; numeric/string values parsed; clamped to 1..168")
    void hoursBeforeParsingAndClamping() {
        assertEquals(24, service.sessionReminderHoursBefore(INSTITUTE)); // no setting at all

        settingBlob("session_reminder", Map.of("hours_before", 48));
        assertEquals(48, service.sessionReminderHoursBefore(INSTITUTE));

        settingBlob("session_reminder", Map.of("hours_before", "72"));
        assertEquals(72, service.sessionReminderHoursBefore(INSTITUTE));

        settingBlob("session_reminder", Map.of("hours_before", 0));
        assertEquals(1, service.sessionReminderHoursBefore(INSTITUTE));

        settingBlob("session_reminder", Map.of("hours_before", 500));
        assertEquals(168, service.sessionReminderHoursBefore(INSTITUTE));

        settingBlob("session_reminder", Map.of("hours_before", "abc"));
        assertEquals(24, service.sessionReminderHoursBefore(INSTITUTE));

        settingBlob("session_reminder", Map.of("hours_before", 3.9d));
        assertEquals(3, service.sessionReminderHoursBefore(INSTITUTE)); // Number.intValue truncates
    }

    @Test
    @DisplayName("inactivity_days: absent → 14; clamped to 1..365")
    void inactivityDaysParsingAndClamping() {
        assertEquals(14, service.checkinInactivityDays(INSTITUTE));

        settingBlob("checkin_reminder", Map.of("inactivity_days", 30));
        assertEquals(30, service.checkinInactivityDays(INSTITUTE));

        settingBlob("checkin_reminder", Map.of("inactivity_days", -5));
        assertEquals(1, service.checkinInactivityDays(INSTITUTE));

        settingBlob("checkin_reminder", Map.of("inactivity_days", 9999));
        assertEquals(365, service.checkinInactivityDays(INSTITUTE));
    }

    @Test
    @DisplayName("triggerEnabled: absent section passes the caller's default through; explicit values win")
    void triggerEnabledDefaults() {
        assertTrue(service.triggerEnabled(INSTITUTE, "session_reminder", true));
        assertFalse(service.triggerEnabled(INSTITUTE, "checkin_reminder", false));

        settingBlob("checkin_reminder", Map.of("enabled", true));
        assertTrue(service.triggerEnabled(INSTITUTE, "checkin_reminder", false));

        settingBlob("session_reminder", Map.of("enabled", false));
        assertFalse(service.triggerEnabled(INSTITUTE, "session_reminder", true));

        settingBlob("session_reminder", Map.of("enabled", "true")); // string form tolerated
        assertTrue(service.triggerEnabled(INSTITUTE, "session_reminder", true));
    }

    @Test
    @DisplayName("a broken settings service never breaks config reads — code defaults apply")
    void settingServiceFailureFallsBackToDefaults() {
        when(instituteSettingService.getSettingByInstituteIdAndKey(anyString(), anyString()))
                .thenThrow(new RuntimeException("settings down"));
        assertEquals(24, service.sessionReminderHoursBefore(INSTITUTE));
        assertEquals(14, service.checkinInactivityDays(INSTITUTE));
        assertTrue(service.triggerEnabled(INSTITUTE, "session_reminder", true));
    }

    // ------------------------------------------------------------------- delivery

    @Test
    @DisplayName("session reminder with the trigger disabled sends nothing on any channel")
    void disabledSessionReminderSendsNothing() {
        settingBlob("session_reminder", Map.of("enabled", false));

        service.notifySessionReminder(INSTITUTE, "Anjali Sharma", "stud-1", "s@x.com",
                null, "Stu Dent", "Career guidance", "Fri, 08 Aug 2026 at 17:00 (Asia/Kolkata)");

        verifyNoInteractions(notificationService);
    }

    @Test
    @DisplayName("check-in nudge is OFF by default — no setting means no sends at all")
    void checkinDefaultOffSendsNothing() {
        when(authService.getUsersFromAuthServiceByUserIds(anyList())).thenReturn(List.of());

        service.notifyCheckinReminder(INSTITUTE, "stud-1", "Anjali Sharma");

        verifyNoInteractions(notificationService);
    }

    @Test
    @DisplayName("enabled check-in nudge fires alert + push with the mentor's name substituted")
    void enabledCheckinDeliversAlertAndPush() {
        settingBlob("checkin_reminder", Map.of("enabled", true));
        when(authService.getUsersFromAuthServiceByUserIds(anyList())).thenReturn(List.of());
        when(templateRepository.findByInstituteIdAndNameAndType(anyString(), anyString(), anyString()))
                .thenReturn(Optional.empty());

        service.notifyCheckinReminder(INSTITUTE, "stud-1", "Anjali Sharma");

        ArgumentCaptor<String> alertBody = ArgumentCaptor.forClass(String.class);
        verify(notificationService).createSystemAlertAnnouncement(
                eq(INSTITUTE), eq(List.of("stud-1")), anyString(), alertBody.capture(),
                any(), any(), any(), any());
        assertTrue(alertBody.getValue().contains("Anjali Sharma"), alertBody.getValue());
        verify(notificationService).sendPushViaUnified(eq(INSTITUTE), eq(List.of("stud-1")),
                anyString(), anyString(), any());
        // Student could not be hydrated → no email address → the email channel is skipped.
        verify(notificationService, never()).sendEmailViaUnified(any(), anyString());
        verify(notificationService, never()).sendHtmlEmailViaUnified(
                anyString(), anyString(), anyString(), anyString(), any(), any(), anyString());
    }

    @Test
    @DisplayName("no DB template rows → inline default email with all placeholders substituted")
    void inlineFallbackEmailSubstitutesPlaceholders() {
        when(instituteSettingService.getSettingByInstituteIdAndKey(INSTITUTE, SETTING_KEY))
                .thenReturn(null);
        when(authService.getUsersFromAuthServiceByUserIds(anyList())).thenReturn(List.of());
        when(templateRepository.findByInstituteIdAndNameAndType(anyString(), anyString(), anyString()))
                .thenReturn(Optional.empty());

        service.notifySessionReminder(INSTITUTE, "Anjali Sharma", "stud-1", "s@x.com",
                null, "Stu Dent", "Career guidance", "Fri, 08 Aug 2026 at 17:00 (Asia/Kolkata)");

        ArgumentCaptor<NotificationDTO> dto = ArgumentCaptor.forClass(NotificationDTO.class);
        verify(notificationService).sendEmailViaUnified(dto.capture(), eq(INSTITUTE));
        assertEquals("Reminder: your mentor session is coming up", dto.getValue().getSubject());
        String body = dto.getValue().getBody();
        assertTrue(body.contains("Career guidance"), body);
        assertTrue(body.contains("Anjali Sharma"), body);
        assertTrue(body.contains("Fri, 08 Aug 2026 at 17:00 (Asia/Kolkata)"), body);
        assertFalse(body.contains("{{"), "unresolved placeholder left in: " + body);
    }

    @Test
    @DisplayName("DEFAULT template row wins over the inline body and gets branding + deep link")
    void defaultDbTemplateRenderedWithBrandingVars() {
        when(instituteSettingService.getSettingByInstituteIdAndKey(INSTITUTE, SETTING_KEY))
                .thenReturn(null);
        when(authService.getUsersFromAuthServiceByUserIds(anyList())).thenReturn(List.of());
        Template template = new Template();
        template.setSubject("Coming up on {{institute_name}}");
        template.setContent("<a href=\"{{cta_url}}/my-mentors\">Hi {{recipient_name}}</a>");
        when(templateRepository.findByInstituteIdAndNameAndType(INSTITUTE, "Mentor Session Reminder", "EMAIL"))
                .thenReturn(Optional.empty());
        when(templateRepository.findByInstituteIdAndNameAndType("DEFAULT", "Mentor Session Reminder", "EMAIL"))
                .thenReturn(Optional.of(template));
        when(instituteRepository.findById(INSTITUTE)).thenReturn(Optional.empty());
        when(domainRoutingRepository.findByInstituteIdAndRole(INSTITUTE, "LEARNER"))
                .thenReturn(Optional.empty());

        service.notifySessionReminder(INSTITUTE, "Anjali Sharma", "stud-1", "s@x.com",
                null, "Stu Dent", "Career guidance", "Fri, 08 Aug 2026 at 17:00 (Asia/Kolkata)");

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(notificationService).sendHtmlEmailViaUnified(
                eq("s@x.com"), anyString(), body.capture(), eq(INSTITUTE), any(), any(), eq("TRANSACTIONAL"));
        assertTrue(body.getValue().contains("https://learner.vacademy.io/my-mentors"), body.getValue());
        assertTrue(body.getValue().contains("Hi Stu Dent"), body.getValue());
        assertFalse(body.getValue().contains("{{"), body.getValue());
        // The branded template replaced the plain inline email — not both.
        verify(notificationService, never()).sendEmailViaUnified(any(), anyString());
    }

    @Test
    @DisplayName("WhatsApp stays silent when enabled without an approved template name")
    void whatsappWithoutTemplateNameIsSkipped() {
        settingBlob("session_reminder", Map.of("whatsapp", Map.of("enabled", true)));
        when(authService.getUsersFromAuthServiceByUserIds(anyList())).thenReturn(List.of());
        when(templateRepository.findByInstituteIdAndNameAndType(anyString(), anyString(), anyString()))
                .thenReturn(Optional.empty());

        service.notifySessionReminder(INSTITUTE, "Anjali Sharma", "stud-1", "s@x.com",
                "+919876543210", "Stu Dent", "Career guidance", "Fri, 08 Aug 2026 at 17:00 (IST)");

        verify(notificationService, never()).sendUnified(any());
    }
}
