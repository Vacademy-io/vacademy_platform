package vacademy.io.admin_core_service.features.course_settings.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One connection field in an LMS provider's setup form. Drives a data-driven, non-technical
 * settings UI: the frontend renders label + help + the right input from this, instead of
 * hardcoding each provider's fields.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LmsProviderFieldDTO {
    /** Stored key under LMS_SETTING.data.data (e.g. apiUrl, apiSecret). */
    private String key;
    /** Plain-language label shown to the institute admin. */
    private String label;
    /** "Where do I find this?" helper text. */
    private String help;
    private String placeholder;
    /** url | text | secret — drives input type, masking and validation. */
    private String type;
    private boolean required;
}
