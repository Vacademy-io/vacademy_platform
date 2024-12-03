package vacademy.io.common.institute.entity;


import java.time.LocalDateTime;
import java.util.Date;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "package", schema = "public")
@Data
@NoArgsConstructor
public class Package {

    @Id
    @Column(name = "id", length = 255)
    @UuidGenerator
    private String id;

    @Column(name = "package_name", length = 255)
    private String packageName;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    // Additional constructors, if needed
    public Package(String id, String packageName, Date createdAt, Date updatedAt) {
        this.id = id;
        this.packageName = packageName;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}