package vacademy.io.admin_core_service.features.workflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "node_template")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class NodeTemplate {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "node_name", nullable = false)
    private String nodeName;

    @Column(name = "node_type", nullable = false)
    private String nodeType;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "config_json", columnDefinition = "TEXT", nullable = false)
    private String configJson; // store JSON string; parsing handled in service

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}