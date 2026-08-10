package vacademy.io.media_service.entity;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;

@Entity
@NoArgsConstructor
@Getter
@Setter
@AllArgsConstructor
public class FileMetadata {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String fileName;

    private String fileType;

    private Long fileSize;

    private String key;

    private String source;

    private String sourceId;

    private Double width;

    private Double height;

    /**
     * Opaque integrity/change token for offline asset diffing (learner offline
     * downloads). Lazily populated from an S3 HeadObject ETag the first time
     * this file is requested via /media-service/internal/offline-asset-details —
     * NOT backfilled, since most files are never requested offline.
     */
    private String checksum;

    /** How to interpret {@link #checksum}, e.g. "S3_ETAG". Null when checksum is null. */
    private String checksumType;

    @Column(name = "updated_on", insertable = false, updatable = false)
    private Date updatedOn;

    @Column(name = "created_on", insertable = false, updatable = false)
    private Date createdOn;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    public FileMetadata(String fileName, String fileType, String key, String source, String sourceId) {
        this.fileName = fileName;
        this.fileType = fileType;
        this.key = key;
        this.source = source;
        this.sourceId = sourceId;
    }
}