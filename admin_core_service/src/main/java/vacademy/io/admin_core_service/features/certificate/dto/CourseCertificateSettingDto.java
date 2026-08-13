package vacademy.io.admin_core_service.features.certificate.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Per-course certificate override, stored in {@code package.course_setting} under
 * the {@code CERTIFICATE_SETTING} key via the existing {@code PackageSettingService}.
 *
 * <p>Every field is nullable and every null means "inherit the institute default".
 * That is what lets an institute keep certificates off globally while switching a
 * single course on — the requirement that motivated the whole redesign.
 */
@Setter
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CourseCertificateSettingDto {

    /**
     * Tri-state on purpose. {@code TRUE} forces certificates on for this course
     * even when the institute default is off; {@code FALSE} forces them off even
     * when the institute is on; {@code null} inherits.
     */
    private Boolean enabled;

    /** Completion percentage required for this course. Null inherits. */
    private Integer thresholdPercent;

    /** Course-specific template HTML. Null inherits the institute template. */
    private String templateHtml;

    // Certificate numbering is deliberately NOT overridable per course. The
    // format is an institute-wide setting so numbers stay consistent and the
    // per-institute sequence remains the single allocator.
}
