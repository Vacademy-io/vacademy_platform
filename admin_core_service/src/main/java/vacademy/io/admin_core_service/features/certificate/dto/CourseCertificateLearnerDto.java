package vacademy.io.admin_core_service.features.certificate.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/** One row of the course Certificates student table. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CourseCertificateLearnerDto {

    private String userId;
    private String fullName;
    private String email;

    /** Null when the learner has no progress rollup row yet. */
    private Double completionPercentage;

    /** GENERATED | AWAITING | PENDING. */
    private String status;

    /** The human-readable certificate number; null when not yet issued. */
    private String certificateNumber;

    /** MediaService file id of the PDF, for preview/download. */
    private String fileId;

    private Date issuedAt;
}
