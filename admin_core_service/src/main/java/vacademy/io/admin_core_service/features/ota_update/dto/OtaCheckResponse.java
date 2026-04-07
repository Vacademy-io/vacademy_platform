package vacademy.io.admin_core_service.features.ota_update.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OtaCheckResponse {

    private Boolean updateAvailable;
    private String version;
    private String bundleDownloadUrl;
    private String checksum;
    private Long bundleSizeBytes;
    private Boolean forceUpdate;
    private String releaseNotes;

    public static OtaCheckResponse noUpdate() {
        return OtaCheckResponse.builder()
                .updateAvailable(false)
                .build();
    }
}
