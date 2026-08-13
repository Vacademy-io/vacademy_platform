package vacademy.io.assessment_service.features.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "assessment_custom_fields")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentCustomField {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "field_name", nullable = false)
    private String fieldName;

    @Column(name = "field_key", nullable = false)
    private String fieldKey;

    @Column(name = "field_order", nullable = false)
    private Integer fieldOrder;

    @Column(name = "comma_separated_options", nullable = true)
    private String commaSeparatedOptions;

    /**
     * Per-field settings as JSON — help text, default value, checkbox heading/consent body,
     * file constraints. One blob rather than a column per setting, matching
     * custom_fields.config in admin_core_service. Null means "no extra settings".
     */
    @Column(name = "config", nullable = true)
    private String config;

    @Column(name = "status", nullable = true)
    private String status;

    @ManyToOne
    @JoinColumn(name = "assessment_id")
    @JsonIgnore
    private Assessment assessment;


    @Column(name = "is_mandatory", nullable = false)
    private Boolean isMandatory;

    @Column(name = "field_type", nullable = false)
    private String fieldType; // e.g. short_string, number, input_string

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}