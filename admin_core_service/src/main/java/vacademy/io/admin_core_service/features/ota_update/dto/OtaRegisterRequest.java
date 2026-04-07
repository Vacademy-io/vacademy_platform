package vacademy.io.admin_core_service.features.ota_update.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OtaRegisterRequest {

    @NotBlank
    private String version;

    private String platform;

    @NotBlank
    private String bundleFileId;

    @NotBlank
    private String bundleDownloadUrl;

    @NotBlank
    private String checksum;

    private Long bundleSizeBytes;

    private String minNativeVersion;

    private Boolean forceUpdate;

    /**
     * Comma-separated app IDs for institute targeting.
     * NULL means all institutes.
     */
    private String targetAppIds;

    private String releaseNotes;
}
