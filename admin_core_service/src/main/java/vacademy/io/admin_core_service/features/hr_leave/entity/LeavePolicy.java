package vacademy.io.admin_core_service.features.hr_leave.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "hr_leave_policy")
public class LeavePolicy {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "leave_type_id", nullable = false)
    private LeaveType leaveType;

    @Column(name = "annual_quota", nullable = false, precision = 5, scale = 1)
    private BigDecimal annualQuota;

    @Column(name = "accrual_type", length = 20)
    private String accrualType;

    @Column(name = "accrual_amount", precision = 5, scale = 2)
    private BigDecimal accrualAmount;

    @Column(name = "pro_rata_enabled")
    private Boolean proRataEnabled;

    @Column(name = "applicable_after_days")
    private Integer applicableAfterDays;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "applicable_employment_types", columnDefinition = "jsonb")
    private List<String> applicableEmploymentTypes;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

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
