package vacademy.io.common.institute.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "level", schema = "public")
@Data
@NoArgsConstructor
public class Level {

    @Id
    @Column(name = "id")
    @UuidGenerator
    private String id;

    @Column(name = "level_name", length = 255)
    private String levelName;

    @Column(name = "duration_in_days")
    private Integer durationInDays;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "status")
    private String status = "ACTIVE";

    @Column(name = "thumbnail_file_id", length = 255)
    private String thumbnailFileId;

    // Additional constructors, if needed
    public Level(String id, String levelName, Integer durationInDays,String status,String thumbnailFileId, Date createdAt, Date updatedAt) {
        this.id = id;
        this.levelName = levelName;
        this.durationInDays = durationInDays;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.status = status;
        this.thumbnailFileId = thumbnailFileId;
    }
}