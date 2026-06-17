package vacademy.io.community_service.feature.support.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "institute_engineer_assignment", schema = "public",
        uniqueConstraints = @UniqueConstraint(name = "uq_institute_engineer",
                columnNames = { "institute_id", "engineer_id" }))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class InstituteEngineerAssignment {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "engineer_id", nullable = false)
    private String engineerId;

    /** The lead/primary dedicated engineer for the institute. */
    @Column(name = "is_primary", nullable = false)
    @Builder.Default
    private boolean primary = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;
}
