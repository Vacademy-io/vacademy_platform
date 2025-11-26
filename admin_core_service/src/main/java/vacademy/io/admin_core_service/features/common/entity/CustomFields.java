package vacademy.io.admin_core_service.features.common.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;

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

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "is_hidden")
    private Boolean isHidden = false;

    public CustomFields(CustomFieldDTO customFieldDTO) {
        if (StringUtils.hasText(customFieldDTO.getId()))
            this.id = customFieldDTO.getId();

        if (StringUtils.hasText(customFieldDTO.getFieldKey()))
            this.fieldKey = customFieldDTO.getFieldKey();

        if (StringUtils.hasText(customFieldDTO.getFieldName()))
            this.fieldName = customFieldDTO.getFieldName();

        if (StringUtils.hasText(customFieldDTO.getFieldType()))
            this.fieldType = customFieldDTO.getFieldType();

        if (StringUtils.hasText(customFieldDTO.getDefaultValue()))
            this.defaultValue = customFieldDTO.getDefaultValue();

        if (StringUtils.hasText(customFieldDTO.getConfig()))
            this.config = customFieldDTO.getConfig();

        if (customFieldDTO.getFormOrder() != null)
            this.formOrder = customFieldDTO.getFormOrder();

        if (customFieldDTO.getIsMandatory() != null)
            this.isMandatory = customFieldDTO.getIsMandatory();

        if (customFieldDTO.getIsFilter() != null)
            this.isFilter = customFieldDTO.getIsFilter();

        if (customFieldDTO.getIsSortable() != null)
            this.isSortable = customFieldDTO.getIsSortable();

        if (customFieldDTO.getIsHidden() != null)
            this.isHidden = customFieldDTO.getIsHidden();
    }

    @PrePersist
    private void setDefaultStatus(){
        if(status == null){
            this.status = StatusEnum.ACTIVE.name();
        }
    }
}
