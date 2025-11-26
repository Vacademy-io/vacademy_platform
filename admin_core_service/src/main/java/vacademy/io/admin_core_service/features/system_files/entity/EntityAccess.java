package vacademy.io.admin_core_service.features.system_files.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "entity_access")
public class EntityAccess {

        @Id
        @UuidGenerator
        private String id;

        @Column(name = "access_type", nullable = false, length = 50)
        private String accessType;

        @Column(name = "level", nullable = false, length = 50)
        private String level;

        @Column(name = "level_id", nullable = false)
        private String levelId;

        @Column(name = "entity", nullable = false, length = 100)
        private String entity;

        @Column(name = "entity_id", nullable = false)
        private String entityId;

        @CreationTimestamp
        @Column(name = "created_at", nullable = false, updatable = false)
        private Timestamp createdAt;

        @UpdateTimestamp
        @Column(name = "updated_at", nullable = false)
        private Timestamp updatedAt;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "entity_id", referencedColumnName = "id", insertable = false, updatable = false)
        private SystemFile systemFile;
}
