package vacademy.io.common.institute.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.Date;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "package_session")
@Data
@NoArgsConstructor
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
    private LocalDate startTime;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "status")
    private String status;

    @ManyToOne
    @JoinColumn(name = "package_id", referencedColumnName = "id")
    private Package packageEntity; // Assuming Package is another entity representing the "package" table

    // Additional constructors, if needed
    public PackageSession(String id, Level level, Session session, LocalDate startTime,
                          Date createdAt, Date updatedAt, String status, Package packageEntity) {
        this.id = id;
        this.level = level;
        this.session = session;
        this.startTime = startTime;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.status = status;
        this.packageEntity = packageEntity;
    }
}