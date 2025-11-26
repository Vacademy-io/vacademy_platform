package vacademy.io.admin_core_service.features.system_files.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.system_files.enums.StatusEnum;

import java.sql.Timestamp;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "system_files")
public class SystemFile {

        @Id
        @UuidGenerator
        private String id;

        @Column(name = "file_type", nullable = false, length = 50)
        private String fileType;

        @Column(name = "media_type", nullable = false, length = 50)
        private String mediaType;

        @Column(name = "data", nullable = false, columnDefinition = "TEXT")
        private String data;

        @Column(name = "name", nullable = false)
        private String name;

        @Column(name = "folder_name")
        private String folderName;

        @Column(name = "thumbnail_file_id")
        private String thumbnailFileId;

        @Column(name = "description", columnDefinition = "TEXT")
        private String description;

        @Column(name = "institute_id", nullable = false)
        private String instituteId;

        @Column(name = "created_by_user_id", nullable = false)
        private String createdByUserId;

        @Column(name = "status", nullable = false, length = 50)
        private String status = StatusEnum.ACTIVE.name();

        @CreationTimestamp
        @Column(name = "created_at", nullable = false, updatable = false)
        private Timestamp createdAt;

        @UpdateTimestamp
        @Column(name = "updated_at", nullable = false)
        private Timestamp updatedAt;

        @OneToMany(mappedBy = "systemFile", cascade = CascadeType.ALL, orphanRemoval = true)
        private List<EntityAccess> entityAccesses;
}
