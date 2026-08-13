package vacademy.io.media_service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response shape for /media-service/internal/offline-asset-details. {@code key}
 * is intentionally omitted (never send the raw S3 key to another service over
 * this endpoint) — only size/type/checksum, which is all the offline manifest
 * needs to plan and verify a download.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OfflineAssetDetailsDTO {
    private String id;
    private Long fileSize;
    private String fileType;
    private String checksum;
    private String checksumType;
}
