package vacademy.io.admin_core_service.features.workflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "workflow_node_mapping")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WorkflowNodeMapping {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "workflow_id", nullable = false)
    private String workflowId;

    @Column(name = "node_template_id", nullable = false)
    private String nodeTemplateId;

    @Column(name = "node_order", nullable = false)
    private Integer nodeOrder;

    @Column(name = "is_start_node")
    private Boolean isStartNode;

    @Column(name = "is_end_node")
    private Boolean isEndNode;

    @Column(name = "override_config", columnDefinition = "TEXT")
    private String overrideConfig;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;
}