package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One downloadable file referenced by a slide, in the manifest response.
 * sizeBytes/checksum/checksumType are filled in by OfflineManifestService
 * after a single bulk HMAC call to media_service — this DTO carries the fileId
 * + role from extraction time up to that point.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineAssetRefDTO {
    private String fileId;
    /** VIDEO | DOCUMENT | AUDIO | ASSIGNMENT_ATTACHMENT */
    private String role;
    private Long sizeBytes;
    private String checksum;
    private String checksumType;
}
