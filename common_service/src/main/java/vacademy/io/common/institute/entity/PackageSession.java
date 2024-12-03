package vacademy.io.common.institute.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Date;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "package_session")
@Data
public class PackageSession {

    @Id
    @Column(name = "id", length = 255)
    @UuidGenerator
    private String id;

    @ManyToOne
    @JoinColumn(name = "level_id", referencedColumnName = "id")
    private Level level; // Assuming Level is another entity representing the "level" table

    @ManyToOne
    @JoinColumn(name = "session_id", referencedColumnName = "id")
    private Session session; // Assuming Session is another entity representing the "session" table

    @Column(name = "start_time")
    private Date startTime;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "status")
    private String status;

    @ManyToOne
    @JoinColumn(name = "package_id", referencedColumnName = "id")
    private Package packageEntity; // Assuming Package is another entity representing the "package" table

    public PackageSession(){
    }

}