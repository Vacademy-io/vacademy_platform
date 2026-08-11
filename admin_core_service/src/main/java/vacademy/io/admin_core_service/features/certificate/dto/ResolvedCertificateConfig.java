package vacademy.io.admin_core_service.features.certificate.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateNumberingDto;

import java.util.Map;

/**
 * The effective certificate configuration for one (institute, course) pair, after
 * applying {@code course override → institute default → disabled}.
 *
 * <p>This is the single value every caller should read — the issuance gate, the
 * admin settings dialog and the learner config endpoint all resolve through it,
 * so there is exactly one place where precedence is decided.
 */
@Setter
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResolvedCertificateConfig {

    /** False unless something explicitly switched certificates on. */
    private boolean enabled;

    private int thresholdPercent;

    private String templateHtml;

    private Map<String, String> placeHolders;

    private String aspectRatio;
    private Integer customWidthMm;
    private Integer customHeightMm;

    private CertificateNumberingDto numbering;

    /** Feeds the {@code {COURSE_CODE}} numbering token; may be null. */
    private String courseCode;

    /**
     * True when the course supplied its own {@code enabled} value rather than
     * inheriting. The admin dialog uses this to show "overridden" vs "inherited".
     */
    private boolean enabledOverriddenByCourse;

    /** True when the course supplied its own threshold. */
    private boolean thresholdOverriddenByCourse;
}
