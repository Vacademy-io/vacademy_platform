package vacademy.io.admin_core_service.features.learner_invitation.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationCustomFieldDTO;
import vacademy.io.admin_core_service.features.learner_invitation.enums.CustomFieldStatusEnum;

import java.sql.Timestamp;

@Entity
@Table(name = "learner_invitation_custom_field")
@Getter
@Setter
public class LearnerInvitationCustomField {

    @Id
    @UuidGenerator
    private String id;

    private String fieldName;
    private String fieldType;
    private String commaSeparatedOptions;
    private Boolean isMandatory;
    private String description;
    private String defaultValue;
    private String status; // ACTIVE DELETED

    private Integer fieldOrder;

    @ManyToOne
    @JoinColumn(name = "learner_invitation_id", nullable = false)
    private LearnerInvitation learnerInvitation;  // Must match mappedBy value in LearnerInvitation

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public LearnerInvitationCustomField() {
    }

    public LearnerInvitationCustomField(LearnerInvitationCustomFieldDTO learnerInvitationCustomFieldDTO, LearnerInvitation learnerInvitation) {
        this.fieldName = learnerInvitationCustomFieldDTO.getFieldName();
        this.fieldType = learnerInvitationCustomFieldDTO.getFieldType();
        this.commaSeparatedOptions = learnerInvitationCustomFieldDTO.getCommaSeparatedOptions();
        this.isMandatory = learnerInvitationCustomFieldDTO.getIsMandatory();
        this.description = learnerInvitationCustomFieldDTO.getDescription();
        this.defaultValue = learnerInvitationCustomFieldDTO.getDefaultValue();
        this.learnerInvitation = learnerInvitation;
        this.fieldOrder = learnerInvitationCustomFieldDTO.getFieldOrder();
        this.status = CustomFieldStatusEnum.ACTIVE.name();
    }

    public LearnerInvitationCustomFieldDTO mapToDTO() {
        return LearnerInvitationCustomFieldDTO
                .builder()
                .id(this.id)
                .commaSeparatedOptions(this.commaSeparatedOptions)
                .description(this.description)
                .fieldName(this.fieldName)
                .fieldType(this.fieldType)
                .isMandatory(this.isMandatory)
                .defaultValue(this.defaultValue)
                .status(this.status)
                .build();
    }
}
