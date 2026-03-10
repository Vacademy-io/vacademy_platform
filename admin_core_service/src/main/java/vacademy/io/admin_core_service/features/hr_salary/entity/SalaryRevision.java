package vacademy.io.admin_core_service.features.hr_salary.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "hr_salary_revision")
public class SalaryRevision {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private EmployeeProfile employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "old_structure_id")
    private EmployeeSalaryStructure oldStructure;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "new_structure_id", nullable = false)
    private EmployeeSalaryStructure newStructure;

    @Column(name = "old_ctc", precision = 15, scale = 2)
    private BigDecimal oldCtc;

    @Column(name = "new_ctc", precision = 15, scale = 2)
    private BigDecimal newCtc;

    @Column(name = "increment_pct", precision = 5, scale = 2)
    private BigDecimal incrementPct;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Column(name = "effective_date", nullable = false)
    private LocalDate effectiveDate;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
