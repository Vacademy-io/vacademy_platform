package vacademy.io.media_service.entity;


import jakarta.persistence.*;
import lombok.*;
import vacademy.io.common.media.dto.FileDetailsDTO;

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