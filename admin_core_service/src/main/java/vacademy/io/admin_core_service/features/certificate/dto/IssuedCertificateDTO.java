package vacademy.io.admin_core_service.features.certificate.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * Learner/parent-facing view of an issued certificate.
 *
 * <p>Deliberately omits {@code templateHtmlSnapshot} — that TEXT blob is the
 * institute's template IP and is useless to a learner or parent. It must never
 * leave the service through this DTO.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IssuedCertificateDTO {
    private String certificateId;
    private String courseName;
    private String packageSessionId;
    private Integer completionPercentage;
    private Date issuedAt;
    private String fileId;
    /** Public media URL for the rendered PDF, or null if not yet rendered. */
    private String fileUrl;
}
