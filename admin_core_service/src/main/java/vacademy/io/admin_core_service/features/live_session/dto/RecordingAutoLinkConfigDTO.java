package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

/**
 * Step 2 "auto-add recordings to course" configuration, persisted verbatim as
 * JSON on {@code live_session.recording_auto_link_json}. See
 * docs/LIVE_SESSION_RECORDING_AUTO_LINK_PLAN.md.
 *
 * slide_status: PUBLISHED | DRAFT (default PUBLISHED). destinations reuses the
 * same shape as the manual content-link flow's destinations
 * (package_session_id required, subject_id/module_id may be null depending on
 * course depth, chapter_id required).
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RecordingAutoLinkConfigDTO {
    private Boolean enabled;
    private String slideStatus;
    private Boolean notify;
    private List<ContentLinkDestinationDTO> destinations;
}
