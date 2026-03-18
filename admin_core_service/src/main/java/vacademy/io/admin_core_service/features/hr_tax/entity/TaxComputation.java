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

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "hr_tax_computation")
public class TaxComputation {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private EmployeeProfile employee;

    @Column(name = "financial_year", nullable = false, length = 10)
    private String financialYear;

    @Column(name = "month", nullable = false)
    private Integer month;

    @Column(name = "year", nullable = false)
    private Integer year;

    @Column(name = "projected_annual_income", precision = 15, scale = 2)
    private BigDecimal projectedAnnualIncome;

    @Column(name = "projected_annual_tax", precision = 15, scale = 2)
    private BigDecimal projectedAnnualTax;

    @Column(name = "projected_monthly_tax", precision = 15, scale = 2)
    private BigDecimal projectedMonthlyTax;

    @Column(name = "actual_income_till_date", precision = 15, scale = 2)
    private BigDecimal actualIncomeTillDate;

    @Column(name = "actual_tax_deducted", precision = 15, scale = 2)
    private BigDecimal actualTaxDeducted;

    @Column(name = "total_exemptions", precision = 15, scale = 2)
    private BigDecimal totalExemptions;

    @Column(name = "total_deductions_80c", precision = 15, scale = 2)
    private BigDecimal totalDeductions80c;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "computation_details", columnDefinition = "jsonb")
    private Map<String, Object> computationDetails;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false)
    private LocalDateTime updatedAt;

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = java.time.LocalDateTime.now();
    }
}
