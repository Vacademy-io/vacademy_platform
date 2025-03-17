package vacademy.io.admin_core_service.features.learner_invitation.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationCustomFieldResponseDTO;

import java.sql.Timestamp;

@Entity
@Table(name = "learner_invitation_custom_field_response")
@Getter
@Setter
public class LearnerInvitationCustomFieldResponse {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "custom_field_id", insertable = false, updatable = false)
    private String customFieldId;

    @ManyToOne
    @JoinColumn(name = "custom_field_id", referencedColumnName = "id", nullable = false)
    private LearnerInvitationCustomField customField;


    @ManyToOne
    @JoinColumn(name = "learner_invitation_response_id", nullable = false)
    private LearnerInvitationResponse learnerInvitationResponse;

    @Column(name = "value")
    private String value;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public LearnerInvitationCustomFieldResponse() {}

    public LearnerInvitationCustomFieldResponse(LearnerInvitationCustomFieldResponseDTO learnerInvitationCustomFieldResponseDTO,
                                                LearnerInvitationResponse learnerInvitationResponse) {
        this.customFieldId = learnerInvitationCustomFieldResponseDTO.getCustomFieldId();
        this.value = learnerInvitationCustomFieldResponseDTO.getValue();
        this.learnerInvitationResponse = learnerInvitationResponse;
    }

    public LearnerInvitationCustomFieldResponseDTO mapToDTO(){
        return LearnerInvitationCustomFieldResponseDTO
                .builder()
                .id(this.id)
                .fieldName(this.customField.getFieldName())
                .value(this.value)
                .customFieldId(this.customFieldId)
                .build();
    }
}
