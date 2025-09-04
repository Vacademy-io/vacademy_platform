package vacademy.io.admin_core_service.features.common.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;

import java.util.Date;

@Entity
@Table(name = "custom_fields")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomFields {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "field_key", nullable = false, unique = true, length = 100)
    private String fieldKey;

    @Column(name = "field_name", nullable = false, length = 255)
    private String fieldName;

    @Column(name = "field_type", nullable = false, length = 50)
    private String fieldType;

    @Column(name = "default_value", columnDefinition = "TEXT")
    private String defaultValue;

    @Column(name = "config", columnDefinition = "TEXT")
    private String config;

    @Column(name = "form_order")
    private Integer formOrder = 0;

    @Column(name = "is_mandatory")
    private Boolean isMandatory = false;

    @Column(name = "is_filter")
    private Boolean isFilter = false;

    @Column(name = "is_sortable")
    private Boolean isSortable = false;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "is_hidden")
    private Boolean isHidden = false;

    public CustomFields(CustomFieldDTO customFieldDTO) {
        this.id = customFieldDTO.getId();
        this.fieldKey = customFieldDTO.getFieldKey();
        this.fieldName = customFieldDTO.getFieldName();
        this.fieldType = customFieldDTO.getFieldType();
        this.defaultValue = customFieldDTO.getDefaultValue();
        this.config = customFieldDTO.getConfig();
        this.formOrder = customFieldDTO.getFormOrder();
        this.isMandatory = customFieldDTO.getIsMandatory();
        this.isFilter = customFieldDTO.getIsFilter();
        this.isSortable = customFieldDTO.getIsSortable();
        this.isHidden = customFieldDTO.getIsHidden();
    }
}
