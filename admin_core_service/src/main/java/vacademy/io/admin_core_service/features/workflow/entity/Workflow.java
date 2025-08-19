package vacademy.io.admin_core_service.features.workflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "workflow")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Workflow {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description")
    private String description;

    @Column(name = "status", nullable = false)
    private String status; // ACTIVE, INACTIVE, DRAFT

    @Column(name = "workflow_type", nullable = false)
    private String workflowType; // SCHEDULED, MANUAL

    @Column(name = "created_by_user_id", nullable = false)
    private String createdByUserId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}