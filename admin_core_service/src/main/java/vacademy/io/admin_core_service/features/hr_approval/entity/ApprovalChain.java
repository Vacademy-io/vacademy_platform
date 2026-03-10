package vacademy.io.admin_core_service.features.hr_approval.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "hr_approval_chain")
public class ApprovalChain {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "entity_type", nullable = false, length = 50)
    private String entityType;

    @Column(name = "approval_levels")
    private Integer approvalLevels;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "level_config", columnDefinition = "jsonb")
    private List<Map<String, Object>> levelConfig;

    @Column(name = "auto_approve_after_days")
    private Integer autoApproveAfterDays;

    @Column(name = "status", length = 20)
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false)
    private LocalDateTime updatedAt;

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = java.time.LocalDateTime.now();
    }
}
