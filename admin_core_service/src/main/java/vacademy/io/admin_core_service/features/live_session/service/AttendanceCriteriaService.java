package vacademy.io.admin_core_service.features.live_session.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.live_session.dto.AttendanceCriteriaConfigDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;

/**
 * Resolves the attendance-criteria config for a session, from the session's own
 * {@code attendance_criteria_json} and nothing else.
 *
 * <p>Deliberately <b>not</b> falling back to the institute setting at read time,
 * unlike {@link RecordingAutoLinkService#resolveConfig}. The institute's
 * {@code defaultAttendanceCriteria} is a scheduling-time default: the admin UI
 * copies it onto each session as it is created (see
 * {@code Step2Service.processAttendanceCriteria}), the same way
 * {@code defaultNotifyOnAttendance} and {@code defaultBbbRecordEnabled} work.
 *
 * <p>A read-time fallback would mean switching the setting on retroactively
 * re-decides attendance for every class already scheduled — including classes
 * already taught whose callback simply hasn't landed yet, which for ~14% of
 * classes is up to three days later. Attendance already recorded must not
 * change because someone edited a setting afterwards.
 *
 * <p>Every failure path resolves to OFF rather than throwing. Attendance is
 * disputed data: malformed config must leave the existing status alone, not
 * take a guess at it.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AttendanceCriteriaService {

    private static final String LIVE_SESSION_SETTING_KEY = "LIVE_SESSION_SETTING";
    private static final String CRITERIA_NODE = "defaultAttendanceCriteria";

    private final InstituteSettingService instituteSettingService;
    private final ObjectMapper objectMapper;

    /**
     * The institute's current default, read <b>only</b> when a class is created
     * so it can be stamped onto that class. Never called at evaluation time —
     * see the class javadoc for why.
     *
     * <p>Deliberately server-side: seeding this through the scheduling form
     * meant that if the settings request hadn't resolved when the form
     * initialised, the class was created with the rule switched off and nothing
     * anywhere reported a problem.
     */
    public AttendanceCriteriaConfigDTO resolveInstituteDefault(String instituteId) {
        if (!StringUtils.hasText(instituteId)) {
            return AttendanceCriteriaConfigDTO.off();
        }
        try {
            Object rawData = instituteSettingService.getSettingByInstituteIdAndKey(
                    instituteId, LIVE_SESSION_SETTING_KEY);
            if (rawData == null) {
                return AttendanceCriteriaConfigDTO.off();
            }
            var node = objectMapper.valueToTree(rawData).path(CRITERIA_NODE);
            if (!node.isObject()) {
                return AttendanceCriteriaConfigDTO.off();
            }
            AttendanceCriteriaConfigDTO config =
                    objectMapper.treeToValue(node, AttendanceCriteriaConfigDTO.class);
            return config != null ? config : AttendanceCriteriaConfigDTO.off();
        } catch (Exception e) {
            log.warn("attendance_criteria.institute_default_read_failed instituteId={}: {}",
                    instituteId, e.getMessage());
            return AttendanceCriteriaConfigDTO.off();
        }
    }

    public AttendanceCriteriaConfigDTO resolve(LiveSession session) {
        if (session == null || !StringUtils.hasText(session.getAttendanceCriteriaJson())) {
            return AttendanceCriteriaConfigDTO.off();
        }
        try {
            AttendanceCriteriaConfigDTO config = objectMapper.readValue(
                    session.getAttendanceCriteriaJson(), AttendanceCriteriaConfigDTO.class);
            return config != null ? config : AttendanceCriteriaConfigDTO.off();
        } catch (Exception e) {
            log.warn("attendance_criteria.session_config_parse_failed sessionId={}: {}",
                    session.getId(), e.getMessage());
            return AttendanceCriteriaConfigDTO.off();
        }
    }
}
