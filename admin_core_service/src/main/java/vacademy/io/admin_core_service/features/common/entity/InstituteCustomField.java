package vacademy.io.admin_core_service.features.common.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;

import java.sql.Date;

@Entity
@Table(name = "institute_custom_fields")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstituteCustomField {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "custom_field_id", nullable = false)
    private String customFieldId;

    @Column(name = "type", nullable = false)
    private String type; // e.g., "session"

    @Column(name = "type_id")
    private String typeId; // session id

    @Column(name = "group_name")
    private String groupName;

    @Column(name = "group_internal_order")
    private Integer groupInternalOrder;

    @Column(name = "individual_order")
    private Integer individualOrder;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "status")
    private String status = "ACTIVE";

    public InstituteCustomField(InstituteCustomFieldDTO instituteCustomFieldDTO) {
        if (instituteCustomFieldDTO.getId() != null)
            this.id = instituteCustomFieldDTO.getId();

        if (StringUtils.hasText(instituteCustomFieldDTO.getInstituteId()))
            this.instituteId = instituteCustomFieldDTO.getInstituteId();

        if (instituteCustomFieldDTO.getCustomField() != null &&
                instituteCustomFieldDTO.getCustomField().getId() != null)
            this.customFieldId = instituteCustomFieldDTO.getCustomField().getId();

        if (StringUtils.hasText(instituteCustomFieldDTO.getType()))
            this.type = instituteCustomFieldDTO.getType();

        if (StringUtils.hasText(instituteCustomFieldDTO.getTypeId()))
            this.typeId = instituteCustomFieldDTO.getTypeId();

        if (StringUtils.hasText(instituteCustomFieldDTO.getGroupName()))
            this.groupName = instituteCustomFieldDTO.getGroupName();

        if (instituteCustomFieldDTO.getIndividualOrder() != null)
            this.individualOrder = instituteCustomFieldDTO.getIndividualOrder();

        if (instituteCustomFieldDTO.getGroupInternalOrder() != null)
            this.groupInternalOrder = instituteCustomFieldDTO.getGroupInternalOrder();

        if (StringUtils.hasText(instituteCustomFieldDTO.getStatus()))
            this.status = instituteCustomFieldDTO.getStatus();
        else if (this.status == null)
            this.status = StatusEnum.ACTIVE.name();
    }

}
