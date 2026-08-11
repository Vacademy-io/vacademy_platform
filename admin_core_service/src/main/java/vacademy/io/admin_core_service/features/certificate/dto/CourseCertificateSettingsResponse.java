package vacademy.io.admin_core_service.features.certificate.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * What the course certificate settings dialog needs: the values actually in
 * force, the raw course override, and enough context to render "inherited from
 * institute" versus "overridden for this course".
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CourseCertificateSettingsResponse {

    /** In force after resolution — what issuance will actually use. */
    private boolean effectiveEnabled;
    private int effectiveThresholdPercent;

    /** The institute defaults, so the dialog can show what inheriting would mean. */
    private boolean instituteEnabled;
    private int instituteThresholdPercent;

    /** The raw per-course record; null when the course has never been configured. */
    private CourseCertificateSettingDto courseOverride;

    private boolean enabledOverriddenByCourse;
    private boolean thresholdOverriddenByCourse;

    /** True when the course has its own template rather than the institute's. */
    private boolean hasCourseTemplate;
}
