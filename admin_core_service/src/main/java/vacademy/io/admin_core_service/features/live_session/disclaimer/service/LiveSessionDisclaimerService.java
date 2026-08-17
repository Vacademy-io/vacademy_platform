package vacademy.io.admin_core_service.features.live_session.disclaimer.service;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.live_session.disclaimer.dto.LiveSessionDisclaimerDTO;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionLogsRepository;
import vacademy.io.common.institute.entity.Institute;

import java.util.Map;

/**
 * The disclaimer video shown before a learner joins a live class they have not
 * attended yet — once per class, not once per learner.
 *
 * <p>Two pieces of state, neither of them new:</p>
 * <ul>
 *   <li><b>which video</b> — {@code LIVE_SESSION_SETTING.disclaimerVideoUrl}, institute
 *       configuration, so every live class follows it and there is nothing to set per
 *       session or per day (including sessions a workflow creates each morning).</li>
 *   <li><b>who has seen it for THIS class</b> — ATTENDANCE. A learner already marked
 *       present in a given class has been through its disclaimer, so attendance IS the
 *       record. No acknowledgement table, no extra write, and nothing that can drift out
 *       of step with whether they actually attended. Every NEW class shows it again —
 *       a learner who came yesterday is still a newcomer to today's class.</li>
 * </ul>
 *
 * <p>Consequence worth knowing: a learner who joins but is never marked present is asked
 * again next time — which reads correctly, since they did not actually attend.</p>
 */
@Service
@RequiredArgsConstructor
public class LiveSessionDisclaimerService {

    private static final Logger log = LoggerFactory.getLogger(LiveSessionDisclaimerService.class);

    private final InstituteRepository instituteRepository;
    private final InstituteSettingService instituteSettingService;
    private final LiveSessionLogsRepository liveSessionLogsRepository;

    private static final String ATTENDANCE_RECORDED = "ATTENDANCE_RECORDED";

    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    /**
     * Whether this learner still has to watch the disclaimer before joining this class.
     *
     * <p>Required for every class the learner has not been marked present in yet — a
     * regular attending daily classes sees it each morning, and stops seeing it for a
     * given class once their attendance for it is recorded. It is NOT once per learner:
     * a class they have never been in is a class they have not been disclaimed for.</p>
     *
     * <p>MUST therefore be asked BEFORE attendance is marked for the class. Attendance
     * is written at the moment of joining, so a caller that marks first and asks second
     * always gets "not required" and the video never appears.</p>
     *
     * <p>Fails OPEN: any problem reading the setting or the attendance history returns
     * "not required" rather than blocking. A learner must never be locked out of a class
     * they paid for because a lookup was unavailable.</p>
     */
    public LiveSessionDisclaimerDTO getFor(String userId, String instituteId, String scheduleId) {
        String url = configuredVideoUrl(instituteId);
        if (url == null || url.isBlank()) {
            return LiveSessionDisclaimerDTO.builder().required(false).build();
        }
        if (scheduleId == null || scheduleId.isBlank()) {
            // Without a class there is nothing to be "first time in".
            return LiveSessionDisclaimerDTO.builder().required(false).build();
        }
        try {
            if (liveSessionLogsRepository.existsByUserSourceIdAndScheduleIdAndLogType(
                    userId, scheduleId, ATTENDANCE_RECORDED)) {
                return LiveSessionDisclaimerDTO.builder().required(false).build();
            }
        } catch (Exception e) {
            log.warn("Attendance lookup failed for user {} schedule {} — not blocking the class",
                    userId, scheduleId, e);
            return LiveSessionDisclaimerDTO.builder().required(false).build();
        }
        return LiveSessionDisclaimerDTO.builder().required(true).videoUrl(url).build();
    }

    /** {@code LIVE_SESSION_SETTING.disclaimerVideoUrl}, or null when unset/disabled. */
    private String configuredVideoUrl(String instituteId) {
        if (instituteId == null || instituteId.isBlank()) {
            return null;
        }
        try {
            Institute institute = instituteRepository.findById(instituteId).orElse(null);
            if (institute == null) {
                return null;
            }
            Object data = instituteSettingService.getSettingData(
                    institute, SettingKeyEnums.LIVE_SESSION_SETTING.name());
            if (data == null) {
                return null;
            }
            Map<?, ?> map = mapper.convertValue(data, Map.class);
            if (map == null) {
                return null;
            }
            Object enabled = map.get("disclaimerVideoEnabled");
            if (enabled != null && !Boolean.parseBoolean(String.valueOf(enabled))) {
                return null;
            }
            Object url = map.get("disclaimerVideoUrl");
            return url == null || String.valueOf(url).isBlank() ? null : String.valueOf(url).trim();
        } catch (Exception e) {
            log.warn("Could not read disclaimer video for institute {} — treating as not required",
                    instituteId, e);
            return null;
        }
    }
}
