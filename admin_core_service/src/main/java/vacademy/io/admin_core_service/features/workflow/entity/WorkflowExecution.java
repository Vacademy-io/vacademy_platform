package vacademy.io.admin_core_service.features.workflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "workflow_execution")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WorkflowExecution {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "workflow_id", nullable = false)
    private String workflowId;

    @Column(name = "execution_id", nullable = false, unique = true)
    private String executionId;

    @Column(name = "schedule_id")
    private String scheduleId;

    @Column(name = "schedule_run_id")
    private String scheduleRunId;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "current_node_link_id")
    private String currentNodeLinkId;

    @Column(name = "input_data")
    private String inputData; // JSON text

    @Column(name = "output_data")
    private String outputData; // JSON text

    @Column(name = "started_at", nullable = false)
    private Date startedAt;

    @Column(name = "completed_at")
    private Date completedAt;
}