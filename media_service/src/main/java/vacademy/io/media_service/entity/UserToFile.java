package vacademy.io.media_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.media_service.dto.UserToFileDTO;

import java.util.Date;

@Entity
@Table(name = "user_to_file")
@NoArgsConstructor
@Getter
@Setter
public class UserToFile {

    @Id
    @GeneratedValue
    @UuidGenerator
    private String id;

    @OneToOne
    @JoinColumn(name = "file_id", nullable = false, referencedColumnName = "id")
    private FileMetadata file;

    @ManyToOne
    @JoinColumn(name = "folder_icon", nullable = true, referencedColumnName = "id")
    private FileMetadata folderIcon;

    @Column(name = "folder_name")
    private String folderName;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "source_id")
    private String sourceId;

    @Column(name = "status")
    private String status;

    @Column(name = "source_type")
    private String sourceType;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    public UserToFile(FileMetadata file,FileMetadata folderIcon,String folderName,String userId,String sourceType,String sourceId,String status) {
        this.file = file;
        this.folderIcon = folderIcon;
        this.folderName = folderName;
        this.userId = userId;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.status = status;
    }

    public UserToFileDTO mapToUserToFileDTO() {
        UserToFileDTO userToFileDTO = new UserToFileDTO();
        userToFileDTO.setUserId(userId);
        userToFileDTO.setFolderName(folderName);
        userToFileDTO.setSourceId(sourceId);
        userToFileDTO.setSourceType(sourceType);
        return userToFileDTO;
    }

}
