package vacademy.io.admin_core_service.features.common.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
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

    @Column(name = "type_id", nullable = false)
    private String typeId; // session id

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "status")
    private String status = "ACTIVE";

    public InstituteCustomField(InstituteCustomFieldDTO instituteCustomFieldDTO){
        this.id = instituteCustomFieldDTO.getId();
        this.instituteId = instituteCustomFieldDTO.getInstituteId();
        this.customFieldId = instituteCustomFieldDTO.getCustomField().getId();
        this.type = instituteCustomFieldDTO.getType();
        this.typeId = instituteCustomFieldDTO.getTypeId();
        if (instituteCustomFieldDTO.getStatus() != null) {
            this.status = instituteCustomFieldDTO.getStatus();
        }else{
            this.status = StatusEnum.ACTIVE.name();
        }
    }
}

