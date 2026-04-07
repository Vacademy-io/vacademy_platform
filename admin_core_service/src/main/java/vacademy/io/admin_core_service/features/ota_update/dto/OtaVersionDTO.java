package vacademy.io.admin_core_service.features.ota_update.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vacademy.io.admin_core_service.features.ota_update.entity.OtaBundleVersion;

import java.time.ZonedDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OtaVersionDTO {

    private String id;
    private String version;
    private String platform;
    private String bundleFileId;
    private String bundleDownloadUrl;
    private String checksum;
    private Long bundleSizeBytes;
    private String minNativeVersion;
    private Boolean forceUpdate;
    private Boolean isActive;
    private String targetAppIds;
    private String releaseNotes;
    private String publishedBy;
    private ZonedDateTime createdAt;
    private ZonedDateTime updatedAt;

    public static OtaVersionDTO fromEntity(OtaBundleVersion entity) {
        return OtaVersionDTO.builder()
                .id(entity.getId())
                .version(entity.getVersion())
                .platform(entity.getPlatform())
                .bundleFileId(entity.getBundleFileId())
                .bundleDownloadUrl(entity.getBundleDownloadUrl())
                .checksum(entity.getChecksum())
                .bundleSizeBytes(entity.getBundleSizeBytes())
                .minNativeVersion(entity.getMinNativeVersion())
                .forceUpdate(entity.getForceUpdate())
                .isActive(entity.getIsActive())
                .targetAppIds(entity.getTargetAppIds())
                .releaseNotes(entity.getReleaseNotes())
                .publishedBy(entity.getPublishedBy())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
