package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.sql.Timestamp;

@Entity
@Getter
@Setter
@Table(name = "scorm_slide")
public class ScormSlide {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "original_file_id")
    private String originalFileId;

    @Column(name = "launch_path", length = 512)
    private String launchPath;

    @Column(name = "scorm_version", length = 50)
    private String scormVersion;

    @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp updatedAt;

    public ScormSlide() {
    }
}
