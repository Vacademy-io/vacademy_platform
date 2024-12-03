package vacademy.io.common.institute.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.Date;

import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "level", schema = "public")
@Data
@NoArgsConstructor
public class Level {

    @Id
    @Column(name = "id", length = 255)
    private String id;

    @Column(name = "level_name", length = 255)
    private String levelName;

    @Column(name = "duration_in_days")
    private Integer durationInDays;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    // Additional constructors, if needed
    public Level(String id, String levelName, Integer durationInDays, Date createdAt, Date updatedAt) {
        this.id = id;
        this.levelName = levelName;
        this.durationInDays = durationInDays;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}