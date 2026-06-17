package vacademy.io.admin_core_service.features.course_settings.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Result of a live LMS connection test. {@code message} is always human-readable (safe to
 * show an admin verbatim); {@code detail} carries the raw/technical reason for debugging.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LmsConnectionTestResultDTO {
    private boolean ok;
    private String provider;
    private String message;
    private String detail;
}
