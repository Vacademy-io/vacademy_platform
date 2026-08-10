package vacademy.io.admin_core_service.features.learner_offline.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Deserialization target for media_service's
 * POST /media-service/internal/offline-asset-details response — plain
 * camelCase, no snake_case, mirroring media_service's OfflineAssetDetailsDTO
 * (no @JsonNaming on that class either).
 */
@Data
@NoArgsConstructor
public class OfflineAssetDetailsResponseDTO {
    private String id;
    private Long fileSize;
    private String fileType;
    private String checksum;
    private String checksumType;
}
