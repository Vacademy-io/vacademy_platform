package vacademy.io.admin_core_service.features.certificate.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The certificate configuration a learner client needs for one batch.
 *
 * <p>Replaces the learner app reading {@code STUDENT_DISPLAY_SETTINGS.certificates},
 * which was a second, unrelated copy of the enable flag and threshold. Both now
 * come from Certificate Settings via {@code CertificateSettingsResolver}, so the
 * client cannot disagree with the server about whether a certificate is due.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LearnerCertificateConfigDto {

    /** After course-override resolution. False means never call the issue endpoint. */
    private boolean enabled;

    /** Completion percentage at which a certificate becomes due. */
    private int thresholdPercent;
}
