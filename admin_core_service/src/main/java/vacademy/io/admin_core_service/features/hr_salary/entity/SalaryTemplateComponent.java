package vacademy.io.admin_core_service.features.hr_salary.entity;

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
@Table(name = "hr_salary_template_component")
public class SalaryTemplateComponent {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private SalaryTemplate template;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "component_id", nullable = false)
    private SalaryComponent component;

    @Column(name = "calculation_type", nullable = false, length = 30)
    private String calculationType;

    @Column(name = "percentage_value", precision = 8, scale = 4)
    private BigDecimal percentageValue;

    @Column(name = "fixed_value", precision = 15, scale = 2)
    private BigDecimal fixedValue;

    @Column(name = "formula", columnDefinition = "TEXT")
    private String formula;

    @Column(name = "min_value", precision = 15, scale = 2)
    private BigDecimal minValue;

    @Column(name = "max_value", precision = 15, scale = 2)
    private BigDecimal maxValue;

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(name = "is_mandatory")
    private Boolean isMandatory;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false)
    private LocalDateTime updatedAt;

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = java.time.LocalDateTime.now();
    }
}
