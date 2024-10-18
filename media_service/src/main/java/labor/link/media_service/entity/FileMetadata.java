package labor.link.media_service.entity;


import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;

import java.util.Date;

@Entity
@Data
@NoArgsConstructor
@RequiredArgsConstructor
public class FileMetadata {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    @NonNull
    private String fileName;
    @NonNull
    private String fileType;
    private Long fileSize;
    @NonNull
    private String key;
    @NonNull
    private String source;
    @NonNull
    private String sourceId;

    @Column(name = "updated_on", insertable = false, updatable = false)
    private Date updatedOn;

    @Column(name = "created_on", insertable = false, updatable = false)
    private Date createdOn;
}