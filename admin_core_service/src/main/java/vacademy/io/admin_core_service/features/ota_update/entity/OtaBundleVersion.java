package vacademy.io.admin_core_service.features.ota_update.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.ZonedDateTime;

@Entity
@Table(name = "ota_bundle_version")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OtaBundleVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "version", nullable = false, unique = true, length = 20)
    private String version;

    @Column(name = "platform", nullable = false, length = 10)
    @Builder.Default
    private String platform = "ALL";

    @Column(name = "bundle_file_id", nullable = false)
    private String bundleFileId;

    @Column(name = "bundle_download_url", nullable = false)
    private String bundleDownloadUrl;

    @Column(name = "checksum", nullable = false, length = 64)
    private String checksum;

    @Column(name = "bundle_size_bytes")
    private Long bundleSizeBytes;

    @Column(name = "min_native_version", nullable = false, length = 20)
    @Builder.Default
    private String minNativeVersion = "1.0.0";

    @Column(name = "force_update", nullable = false)
    @Builder.Default
    private Boolean forceUpdate = false;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    /**
     * Comma-separated app IDs for institute targeting.
     * NULL means all institutes. e.g. "com.sevencs.app,io.vacademy.student.app"
     */
    @Column(name = "target_app_ids")
    private String targetAppIds;

    @Column(name = "release_notes")
    private String releaseNotes;

    @Column(name = "published_by")
    private String publishedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private ZonedDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private ZonedDateTime updatedAt;
}
