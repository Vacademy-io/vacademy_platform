package vacademy.io.admin_core_service.features.course_settings.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * "Use this LMS for this course": picks one of the institute's saved LMS connections and the
 * course's id in that LMS, and (optionally) attaches an existing enrolment workflow so it fires
 * when learners enrol.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplyLmsConnectionRequest {
    /** id of an institute LMS connection (LMS_SETTING.data.data.connections[].id). */
    private String connectionId;
    /** The course's id in that LMS (Moodle: moodleCourseId; LearnDash: course id). Optional. */
    private String courseId;
    /** Deprecated single-workflow form — use {@link #workflowIds}. Merged in for back-compat. */
    private String workflowId;
    /**
     * The full set of enrolment workflows to attach to this course (multi-select). Treated as
     * authoritative: workflows here are attached, ones previously attached but absent are detached.
     * null = leave triggers untouched; empty = detach all.
     */
    private List<String> workflowIds;
    /** Optional extra key–value pairs merged verbatim into the per-course LMS setting JSON. */
    private Map<String, String> extraFields;
}
