package vacademy.io.admin_core_service.features.group.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.institute.entity.Group;
import vacademy.io.common.institute.entity.PackageEntity;

import java.sql.Timestamp;

@Entity
public class PackageGroupMapping {
    @Id
    @UuidGenerator
    private String id;

    @JoinColumn(name = "group_id")
    @ManyToOne
    private Group group;

    @ManyToOne
    @JoinColumn(name = "package_id")
    private PackageEntity packageEntity;

    @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp updatedAt;
}
