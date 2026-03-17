package vacademy.io.admin_core_service.features.common.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.common.enums.SyncDirectionEnum;

import java.sql.Timestamp;

/**
 * Mapping between system fields (database columns) and custom fields.
 * Enables bidirectional sync between structured entity fields and dynamic custom fields.
 * 
 * Example mappings:
 * - Student.fullName ↔ custom field "Student Name"
 * - Student.mobileNumber ↔ custom field "Phone"
 */
@Entity
@Table(name = "system_field_custom_field_mapping")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemFieldCustomFieldMapping {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /**
     * The entity type containing the system field.
     * Examples: STUDENT, USER, ENQUIRY
     */
    @Column(name = "entity_type", nullable = false)
    private String entityType;

    /**
     * The actual database column/field name in the entity.
     * Examples: full_name, mobile_number, email
     */
    @Column(name = "system_field_name", nullable = false)
    private String systemFieldName;

    /**
     * Reference to the custom field definition.
     */
    @Column(name = "custom_field_id", nullable = false)
    private String customFieldId;

    /**
     * Sync direction:
     * - BIDIRECTIONAL: Changes sync both ways
     * - TO_SYSTEM: Custom field changes update system field only
     * - TO_CUSTOM: System field changes update custom field only
     * - NONE: No automatic sync (manual only)
     */
    @Column(name = "sync_direction", nullable = false)
    @Enumerated(EnumType.STRING)
    private SyncDirectionEnum syncDirection;

    /**
     * Optional type converter class name for complex transformations.
     * Example: "DateToStringConverter", "PhoneNumberFormatter"
     */
    @Column(name = "converter_class")
    private String converterClass;

    @Column(name = "status")
    private String status = "ACTIVE";

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    @PrePersist
    private void setDefaultStatus() {
        if (status == null) {
            this.status = "ACTIVE";
        }
    }
}
