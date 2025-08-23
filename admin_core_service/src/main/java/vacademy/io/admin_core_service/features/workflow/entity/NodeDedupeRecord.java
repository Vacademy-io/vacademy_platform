package vacademy.io.admin_core_service.features.workflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "node_dedupe_record")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class NodeDedupeRecord {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "workflow_id", nullable = false)
    private String workflowId;

    @Column(name = "node_template_id", nullable = false)
    private String nodeTemplateId;

    @Column(name = "workflow_id_scope")
    private String workflowIdScope;

    @Column(name = "schedule_run_id")
    private String scheduleRunId;

    @Column(name = "operation_key", nullable = false)
    private String operationKey;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;
}