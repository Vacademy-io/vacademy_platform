package vacademy.io.admin_core_service.features.mentorship.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.mentorship.enums.MentorStatus;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Sends mentorship notifications across EMAIL + in-app system alert + FCM push,
 * each channel gated by the institute's {@code MENTORSHIP_SETTING} blob (defaults
 * ALL ON when the setting is absent). Everything is best-effort — a failed
 * notification never breaks the assignment/booking that triggered it.
 *
 * Setting shape (institute setting key MENTORSHIP_SETTING):
 * <pre>
 * { "assignment":   { "email":true, "system_alert":true, "push":true,
 *                     "notify_student":true, "notify_mentor":true },
 *   "booking":      { "system_alert":true, "push":true },
 *   "cancellation": { "email":true, "system_alert":true, "push":true } }
 * </pre>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MentorshipNotificationService {

    public static final String SETTING_KEY = "MENTORSHIP_SETTING";

    private final NotificationService notificationService;
    private final InstituteSettingService instituteSettingService;
    private final MentorRepository mentorRepository;
    private final AuthService authService;

    /** New mentor↔student assignment. */
    public void notifyAssignment(String instituteId, String studentUserId, String mentorUserId,
                                 String mentorDisplayName) {
        try {
            Map<String, Object> cfg = section(instituteId, "assignment");
            boolean email = flag(cfg, "email", true);
            boolean systemAlert = flag(cfg, "system_alert", true);
            boolean push = flag(cfg, "push", true);
            boolean notifyStudent = flag(cfg, "notify_student", true);
            boolean notifyMentor = flag(cfg, "notify_mentor", true);
            if ((!email && !systemAlert && !push) || (!notifyStudent && !notifyMentor)) return;

            List<String> ids = new ArrayList<>();
            if (notifyStudent && studentUserId != null) ids.add(studentUserId);
            if (notifyMentor && mentorUserId != null) ids.add(mentorUserId);
            Map<String, UserDTO> users = hydrate(ids);
            String mentorName = (mentorDisplayName != null && !mentorDisplayName.isBlank())
                    ? mentorDisplayName : nameOf(users.get(mentorUserId), "your mentor");

            if (notifyStudent && studentUserId != null) {
                send(instituteId, studentUserId, users.get(studentUserId), "You have a new mentor",
                        "You've been assigned a mentor: " + mentorName
                                + ". Open My Mentors to book a session or message them.",
                        email, systemAlert, push, "MENTOR_ASSIGNED");
            }
            if (notifyMentor && mentorUserId != null) {
                send(instituteId, mentorUserId, users.get(mentorUserId), "New mentee assigned",
                        "A new student has been assigned to you for mentorship. Open My Mentorship to view them.",
                        email, systemAlert, push, "MENTEE_ASSIGNED");
            }
        } catch (Exception e) {
            log.warn("mentorship assignment notification failed (institute {}): {}", instituteId, e.getMessage());
        }
    }

    /**
     * A mentorship booking was created or cancelled. No-op when the host isn't a mentor
     * (so non-mentorship bookings are unaffected). For CREATED bookings the email is
     * already sent by the booking flow, so only in-app + push are added here; for
     * CANCELLED, email is included too.
     */
    public void notifyBooking(String instituteId, String hostUserId, String inviteeUserId, String inviteeEmail,
                              String inviteeName, String title, String whenText, boolean cancelled) {
        try {
            if (hostUserId == null || mentorRepository
                    .findByInstituteIdAndUserIdAndStatusNot(instituteId, hostUserId, MentorStatus.DELETED.name())
                    .isEmpty()) {
                return; // not a mentor booking
            }
            Map<String, Object> cfg = section(instituteId, cancelled ? "cancellation" : "booking");
            boolean email = cancelled && flag(cfg, "email", true); // created email already sent elsewhere
            boolean systemAlert = flag(cfg, "system_alert", true);
            boolean push = flag(cfg, "push", true);
            if (!email && !systemAlert && !push) return;
            if (inviteeUserId == null || inviteeUserId.isBlank()) {
                // Guest booking with no platform user — only email is possible.
                if (email && inviteeEmail != null && !inviteeEmail.isBlank()) {
                    sendEmailRaw(instituteId, inviteeEmail, inviteeUserId,
                            firstNonBlank(inviteeName, "there"),
                            cancelTitle(cancelled), bookingBody(cancelled, title, whenText), "MENTOR_BOOKING");
                }
                return;
            }
            UserDTO invitee = hydrate(List.of(inviteeUserId)).get(inviteeUserId);
            send(instituteId, inviteeUserId, invitee, cancelTitle(cancelled),
                    bookingBody(cancelled, title, whenText), email, systemAlert, push, "MENTOR_BOOKING");
        } catch (Exception e) {
            log.warn("mentorship booking notification failed (institute {}): {}", instituteId, e.getMessage());
        }
    }

    // ---------- helpers ----------

    private static String cancelTitle(boolean cancelled) {
        return cancelled ? "Mentor session cancelled" : "Mentor session booked";
    }

    private static String bookingBody(boolean cancelled, String title, String whenText) {
        String verb = cancelled ? "was cancelled" : "is confirmed";
        return "Your session \"" + firstNonBlank(title, "Mentor session") + "\" " + verb
                + (whenText != null && !whenText.isBlank() ? " for " + whenText : "") + ".";
    }

    private void send(String instituteId, String userId, UserDTO user, String title, String body,
                      boolean email, boolean systemAlert, boolean push, String type) {
        if (email && user != null && user.getEmail() != null && !user.getEmail().isBlank()) {
            sendEmailRaw(instituteId, user.getEmail(), userId, nameOf(user, "there"), title, body, type);
        }
        if (systemAlert) {
            try {
                notificationService.createSystemAlertAnnouncement(instituteId, List.of(userId), title, body,
                        "SYSTEM", "Mentorship", "ADMIN", null);
            } catch (Exception e) {
                log.warn("mentorship system alert failed: {}", e.getMessage());
            }
        }
        if (push) {
            try {
                notificationService.sendPushViaUnified(instituteId, List.of(userId), title, body, null);
            } catch (Exception e) {
                log.warn("mentorship push failed: {}", e.getMessage());
            }
        }
    }

    private void sendEmailRaw(String instituteId, String email, String userId, String name,
                              String title, String body, String type) {
        try {
            NotificationDTO dto = new NotificationDTO();
            dto.setSubject(title);
            dto.setBody("<p>Hi {{name}},</p><p>" + body + "</p>");
            dto.setNotificationType(type);
            dto.setSource("MENTORSHIP");
            dto.setSourceId(userId);
            NotificationToUserDTO r = new NotificationToUserDTO();
            r.setChannelId(email);
            r.setUserId(userId);
            Map<String, String> ph = new HashMap<>();
            ph.put("name", name);
            r.setPlaceholders(ph);
            dto.setUsers(List.of(r));
            notificationService.sendEmailViaUnified(dto, instituteId);
        } catch (Exception e) {
            log.warn("mentorship email failed: {}", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> section(String instituteId, String key) {
        try {
            Object blob = instituteSettingService.getSettingByInstituteIdAndKey(instituteId, SETTING_KEY);
            if (blob instanceof Map<?, ?> m) {
                Object sec = ((Map<String, Object>) m).get(key);
                if (sec instanceof Map<?, ?> sm) return (Map<String, Object>) sm;
            }
        } catch (Exception ignore) {
            // absent/unreadable → code defaults (all on)
        }
        return null;
    }

    private static boolean flag(Map<String, Object> cfg, String key, boolean def) {
        if (cfg == null) return def;
        Object v = cfg.get(key);
        if (v instanceof Boolean b) return b;
        if (v instanceof String s) return Boolean.parseBoolean(s);
        return def;
    }

    private Map<String, UserDTO> hydrate(List<String> ids) {
        List<String> distinct = ids.stream().filter(i -> i != null && !i.isBlank()).distinct().toList();
        if (distinct.isEmpty()) return Map.of();
        try {
            Map<String, UserDTO> map = new HashMap<>();
            for (UserDTO u : authService.getUsersFromAuthServiceByUserIds(distinct)) {
                if (u != null && u.getId() != null) map.put(u.getId(), u);
            }
            return map;
        } catch (Exception e) {
            return Map.of();
        }
    }

    private static String nameOf(UserDTO u, String fallback) {
        if (u != null && u.getFullName() != null && !u.getFullName().isBlank()) return u.getFullName();
        return fallback;
    }

    private static String firstNonBlank(String a, String b) {
        return (a != null && !a.isBlank()) ? a : b;
    }
}
