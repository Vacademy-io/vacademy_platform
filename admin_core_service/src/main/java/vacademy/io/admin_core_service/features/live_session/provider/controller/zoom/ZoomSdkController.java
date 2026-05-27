package vacademy.io.admin_core_service.features.live_session.provider.controller.zoom;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomJoinPayloadResponse;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomSdkSignatureResponse;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccount;
import vacademy.io.admin_core_service.features.live_session.provider.service.zoom.ZoomAccessTokenService;
import vacademy.io.admin_core_service.features.live_session.provider.service.zoom.ZoomAccountStore;
import vacademy.io.admin_core_service.features.live_session.provider.service.zoom.ZoomAttendanceService;
import vacademy.io.admin_core_service.features.live_session.provider.service.zoom.ZoomSdkSignatureService;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * Issues Zoom Meeting SDK join credentials to authenticated learners (and hosts).
 *
 * The learner dashboard calls this on the embed page; the response carries the
 * signed JWT plus the meeting number, passcode and the learner's display name so
 * the SDK joins with zero prompts.
 */
@RestController
@RequestMapping("/admin-core-service/live-sessions/provider/meeting")
@RequiredArgsConstructor
@Slf4j
public class ZoomSdkController {

    private final SessionScheduleRepository scheduleRepository;
    private final ZoomAccountStore zoomAccountStore;
    private final ZoomSdkSignatureService signatureService;
    private final ZoomAccessTokenService accessTokenService;
    private final ZoomAttendanceService attendanceService;
    private final UserRepository userRepository;

    @GetMapping("/zoom-sdk-signature")
    public ResponseEntity<ZoomSdkSignatureResponse> getSdkSignature(
            @RequestParam String scheduleId,
            @RequestParam(defaultValue = "0") int role,
            @RequestAttribute("user") CustomUserDetails user) {

        SessionSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND,
                        "Schedule not found: " + scheduleId));

        if (schedule.getProviderMeetingId() == null || schedule.getProviderMeetingId().isBlank()) {
            throw new VacademyException(HttpStatus.BAD_REQUEST,
                    "No Zoom meeting has been created for this session yet");
        }
        if (schedule.getProviderAccountId() == null || schedule.getProviderAccountId().isBlank()) {
            throw new VacademyException(HttpStatus.BAD_REQUEST,
                    "This session is not linked to a Zoom account");
        }

        ZoomAccount account = zoomAccountStore.findById(schedule.getProviderAccountId())
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND,
                        "Zoom account for this session no longer exists"));

        String signature = signatureService.buildSignature(
                account, schedule.getProviderMeetingId(), role);

        String zakToken = role == 1 ? accessTokenService.getZakToken(account) : null;

        long tokenExp = Instant.now().getEpochSecond() + signatureService.getValiditySeconds();

        ZoomSdkSignatureResponse response = ZoomSdkSignatureResponse.builder()
                .signature(signature)
                .sdkKey(signatureService.getSdkKey(account))
                .meetingNumber(schedule.getProviderMeetingId())
                .passcode(schedule.getProviderPasscode() != null ? schedule.getProviderPasscode() : "")
                .userName(resolveUserName(user))
                .userEmail(resolveUserEmail(user))
                .role(role)
                .zakToken(zakToken)
                .tokenExp(tokenExp)
                .build();

        // Mark attendance at join — reliable because the request is authenticated.
        // Only for participants (learners); hosts joining as role=1 aren't counted.
        if (role == 0) {
            attendanceService.markPresent(schedule.getSessionId(), scheduleId,
                    user.getUserId(), response.getUserName(), schedule.getProviderMeetingId());
        }

        log.info("zoom.sdk.signature scheduleId={} userId={} role={} userName={} email={} zakIssued={}",
                scheduleId, user.getUserId(), role,
                response.getUserName(), response.getUserEmail(), zakToken != null);
        return ResponseEntity.ok(response);
    }

    /**
     * Native (Capacitor) join payload: a {@code zoommtg://} deep link to open the
     * Zoom app directly into the meeting, plus a web-client fallback URL for when
     * the app isn't installed. The frontend tries the deep link first.
     */
    @GetMapping("/zoom-join-payload")
    public ResponseEntity<ZoomJoinPayloadResponse> getJoinPayload(
            @RequestParam String scheduleId,
            @RequestAttribute("user") CustomUserDetails user) {

        SessionSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND,
                        "Schedule not found: " + scheduleId));

        if (schedule.getProviderMeetingId() == null || schedule.getProviderMeetingId().isBlank()) {
            throw new VacademyException(HttpStatus.BAD_REQUEST,
                    "No Zoom meeting has been created for this session yet");
        }

        String meetingNumber = schedule.getProviderMeetingId();
        String passcode = schedule.getProviderPasscode() != null ? schedule.getProviderPasscode() : "";
        String userName = resolveUserName(user);
        String joinUrl = schedule.getCustomMeetingLink();

        String deepLink = "zoommtg://zoom.us/join?action=join"
                + "&confno=" + meetingNumber
                + "&pwd=" + urlEncode(passcode)
                + "&uname=" + urlEncode(userName)
                + "&zc=0";

        ZoomJoinPayloadResponse response = ZoomJoinPayloadResponse.builder()
                .meetingNumber(meetingNumber)
                .passcode(passcode)
                .userName(userName)
                .deepLink(deepLink)
                .webFallback(toWebClientUrl(joinUrl, meetingNumber))
                .build();

        // Native learners join via the Zoom app — count attendance at this touchpoint.
        attendanceService.markPresent(schedule.getSessionId(), scheduleId,
                user.getUserId(), userName, meetingNumber);

        log.info("zoom.join.payload scheduleId={} userId={}", scheduleId, user.getUserId());
        return ResponseEntity.ok(response);
    }

    private static String urlEncode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    /**
     * Turns a Zoom join URL ({@code https://x.zoom.us/j/<mn>?pwd=token}) into the
     * web-client form ({@code .../wc/join/<mn>?pwd=token}) so the fallback joins in
     * the browser rather than bouncing to an app-download page. Keeps the encrypted
     * pwd token intact.
     */
    private static String toWebClientUrl(String joinUrl, String meetingNumber) {
        if (joinUrl == null || joinUrl.isBlank()) {
            return "https://zoom.us/wc/join/" + meetingNumber;
        }
        if (joinUrl.contains("/j/")) {
            return joinUrl.replaceFirst("/j/", "/wc/join/");
        }
        return joinUrl;
    }

    /** Display name for the SDK — JWT full name, DB fallback, then username. */
    private String resolveUserName(CustomUserDetails user) {
        if (user.getFullName() != null && !user.getFullName().isBlank()) {
            return user.getFullName();
        }
        try {
            var dbUser = userRepository.findById(user.getUserId());
            if (dbUser.isPresent() && dbUser.get().getFullName() != null
                    && !dbUser.get().getFullName().isBlank()) {
                return dbUser.get().getFullName();
            }
        } catch (Exception e) {
            log.warn("zoom.sdk.signature name lookup failed userId={}", user.getUserId());
        }
        return user.getUsername();
    }

    private String resolveUserEmail(CustomUserDetails user) {
        try {
            var dbUser = userRepository.findById(user.getUserId());
            if (dbUser.isPresent() && dbUser.get().getEmail() != null
                    && !dbUser.get().getEmail().isBlank()) {
                return dbUser.get().getEmail();
            }
        } catch (Exception e) {
            // email is optional for the SDK — ignore
        }
        return null;
    }
}
