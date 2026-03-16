package vacademy.io.admin_core_service.features.hr_tax.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;

import java.time.LocalDateTime;
import java.util.Map;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "hr_tax_declaration")
public class TaxDeclaration {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private EmployeeProfile employee;

    @Column(name = "financial_year", nullable = false, length = 10)
    private String financialYear;

    @Column(name = "regime", length = 20)
    private String regime;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "declarations", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> declarations;

    @Column(name = "proof_submitted")
    private Boolean proofSubmitted;

    @Column(name = "proof_verified")
    private Boolean proofVerified;

    @Column(name = "verified_by")
    private String verifiedBy;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

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
