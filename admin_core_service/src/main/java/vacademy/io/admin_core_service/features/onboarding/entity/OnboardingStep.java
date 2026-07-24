package vacademy.io.admin_core_service.features.onboarding.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "onboarding_step")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OnboardingStep {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "flow_id", nullable = false)
    private String flowId;

    @Column(name = "step_order", nullable = false)
    private Integer stepOrder;

    @Column(name = "step_name", nullable = false)
    private String stepName;

    @Column(name = "step_type", nullable = false)
    private String stepType; // e.g. FORM

    @Column(name = "step_type_config")
    private String stepTypeConfig; // JSON, shape depends on stepType

    @Column(name = "is_optional", nullable = false)
    private Boolean isOptional = false;

    @Column(name = "grants_student_role", nullable = false)
    private Boolean grantsStudentRole = false;

    @Column(name = "sends_login_credentials", nullable = false)
    private Boolean sendsLoginCredentials = false;

    /** JSON array: [{role_key, can_view, can_edit}]. Small, bounded, always read/written whole -- no separate table. */
    @Column(name = "role_access")
    private String roleAccess;

    /** JSON array: [{institute_custom_field_id, field_order, is_mandatory, is_hidden, role_access}]. Same reasoning as roleAccess. */
    @Column(name = "fields_config")
    private String fieldsConfig;

    @Column(name = "status", nullable = false)
    private String status; // ACTIVE, ARCHIVED

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
