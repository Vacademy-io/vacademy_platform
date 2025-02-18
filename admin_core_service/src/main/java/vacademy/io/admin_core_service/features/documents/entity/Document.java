package vacademy.io.admin_core_service.features.documents.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.documents.dto.DocumentDTO;
import vacademy.io.admin_core_service.features.documents.enums.DocumentStatusEnum;

import java.sql.Timestamp;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "documents")
public class Document {
    @Id
    @UuidGenerator
    private String id;

    @Column(name = "file_id", nullable = false)
    private String fileId;

    @ManyToOne
    @JoinColumn(name = "folder_id", referencedColumnName = "id", nullable = false)
    private Folder folder;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "access_type", nullable = false)
    private String accessType;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public Document(DocumentDTO documentDTO) {
        this.id = documentDTO.getId() != null ? documentDTO.getId().trim() : null;
        this.fileId = documentDTO.getFileId() != null ? documentDTO.getFileId().trim() : null;
        this.folder = documentDTO.getFolder() != null ? new Folder(documentDTO.getFolder()) : null;
        this.userId = documentDTO.getUserId() != null ? documentDTO.getUserId().trim() : null;
        this.name = documentDTO.getName() != null ? documentDTO.getName().trim() : null;
        this.status = DocumentStatusEnum.ACTIVE.name();
        this.accessType = documentDTO.getAccessType() != null ? documentDTO.getAccessType().trim() : null;
    }

    public DocumentDTO mapToDocumentDTO() {
        DocumentDTO documentDTO = new DocumentDTO();
        documentDTO.setId(id != null ? id.trim() : null);
        documentDTO.setFileId(fileId != null ? fileId.trim() : null);
        documentDTO.setFolder(folder != null ? folder.mapToFolderDTO() : null);
        documentDTO.setUserId(userId != null ? userId.trim() : null);
        documentDTO.setName(name != null ? name.trim() : null);
        documentDTO.setStatus(status);
        documentDTO.setAccessType(accessType != null ? accessType.trim() : null);
        return documentDTO;
    }

}
