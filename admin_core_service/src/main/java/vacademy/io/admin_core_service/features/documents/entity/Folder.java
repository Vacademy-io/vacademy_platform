package vacademy.io.admin_core_service.features.documents.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.documents.dto.FolderDTO;
import vacademy.io.admin_core_service.features.documents.enums.FolderStatusEnum;

import java.sql.Timestamp;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "folders")
public class Folder {
    @Id
    @UuidGenerator
    private String id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @OneToMany(mappedBy = "folder", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Document> documents;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public Folder(FolderDTO folderDTO) {
        this.id = folderDTO.getId() != null ? folderDTO.getId().trim() : null;
        this.name = folderDTO.getName() != null ? folderDTO.getName().trim() : null;
        this.status = FolderStatusEnum.ACTIVE.name();
        this.userId = folderDTO.getUserId() != null ? folderDTO.getUserId().trim() : null;
    }

    public FolderDTO mapToFolderDTO() {
        FolderDTO folderDTO = new FolderDTO();
        folderDTO.setId(this.id != null ? this.id.trim() : null);
        folderDTO.setName(this.name != null ? this.name.trim() : null);
        folderDTO.setStatus(this.status != null ? this.status.trim() : null);
        folderDTO.setUserId(this.userId != null ? this.userId.trim() : null);
        return folderDTO;
    }

}
