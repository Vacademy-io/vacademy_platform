package vacademy.io.admin_core_service.features.hr_tax.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "hr_tax_configuration")
public class TaxConfiguration {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "country_code", nullable = false, length = 3)
    private String countryCode;

    @Column(name = "state_code", length = 10)
    private String stateCode;

    @Column(name = "financial_year_start_month")
    private Integer financialYearStartMonth;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tax_rules", columnDefinition = "jsonb")
    private Map<String, Object> taxRules;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "employer_contributions", columnDefinition = "jsonb")
    private Map<String, Object> employerContributions;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "statutory_settings", columnDefinition = "jsonb")
    private Map<String, Object> statutorySettings;

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
