package vacademy.io.admin_core_service.features.hr_leave.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "hr_leave_type")
public class LeaveType {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "code", nullable = false, length = 20)
    private String code;

    @Column(name = "is_paid")
    private Boolean isPaid;

    @Column(name = "is_carry_forward")
    private Boolean isCarryForward;

    @Column(name = "max_carry_forward")
    private Integer maxCarryForward;

    @Column(name = "is_encashable")
    private Boolean isEncashable;

    @Column(name = "requires_document")
    private Boolean requiresDocument;

    @Column(name = "min_days", precision = 3, scale = 1)
    private BigDecimal minDays;

    @Column(name = "max_consecutive_days")
    private Integer maxConsecutiveDays;

    @Column(name = "applicable_gender", length = 10)
    private String applicableGender;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

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
