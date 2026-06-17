package vacademy.io.admin_core_service.features.course_settings.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Request to live-test an LMS connection from the settings form — BEFORE saving — so the
 * admin gets immediate feedback. Carries the provider id and the current form values.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LmsConnectionTestRequest {
    /** Provider id (LmsSourcesEnum name). */
    private String activeLms;
    /** Connection field values keyed by field key (apiUrl, apiSecret, ...). */
    private Map<String, String> fields;
}
