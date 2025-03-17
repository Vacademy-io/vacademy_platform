package vacademy.io.admin_core_service.features.learner_invitation.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationResponseDTO;
import vacademy.io.admin_core_service.features.learner_invitation.dto.OneLearnerInvitationResponse;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationResponseStatusEnum;

import java.sql.Date;
import java.sql.Timestamp;
import java.util.List;
import java.util.stream.Collectors;

@Entity
@Table(name = "learner_invitation_response")
@Getter
@Setter
public class LearnerInvitationResponse {

    @Id
    @UuidGenerator
    private String id;

    @ManyToOne
    @JoinColumn(name = "learner_invitation_id", nullable = false)
    private LearnerInvitation learnerInvitation;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "status", nullable = false)
    private String status;

    private String fullName;
    private String email;
    private String contactNumber;
    private Date recordedOn;

    @Column(name = "batch_options_json", columnDefinition = "TEXT")
    private String batchOptionsJson;

    @Column(name = "batch_selection_json", columnDefinition = "TEXT")
    private String batchSelectionJson;

    @OneToMany(mappedBy = "learnerInvitationResponse", cascade = CascadeType.ALL)
    private List<LearnerInvitationCustomFieldResponse> customFieldsResponse;

    @Column(name = "message_by_institute", columnDefinition = "TEXT")
    private String messageByInstitute;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public LearnerInvitationResponse() {}

    public LearnerInvitationResponse(LearnerInvitationResponseDTO learnerInvitationResponseDTO,LearnerInvitation learnerInvitation) {
        this.id = learnerInvitationResponseDTO.getId();
        this.instituteId = learnerInvitationResponseDTO.getInstituteId();
        this.status = LearnerInvitationResponseStatusEnum.ACTIVE.name();
        this.fullName = learnerInvitationResponseDTO.getFullName();
        this.email = learnerInvitationResponseDTO.getEmail();
        this.contactNumber = learnerInvitationResponseDTO.getContactNumber();
        this.batchOptionsJson = learnerInvitationResponseDTO.getBatchOptionsJson();
        this.batchSelectionJson = learnerInvitationResponseDTO.getBatchSelectionResponseJson();
        this.learnerInvitation = learnerInvitation;
        this.recordedOn = new Date(System.currentTimeMillis());
    }

    public OneLearnerInvitationResponse mapToOneLearnerInvitationResponse() {
        return OneLearnerInvitationResponse
                .builder()
                .learnerInvitation(learnerInvitation.mapToDTOWithCustomFields())
                .learnerInvitationResponseDTO(this.mapToDTO())
                .build();
    }

    public LearnerInvitationResponseDTO mapToDTO() {
        return LearnerInvitationResponseDTO
                .builder()
                .id(this.id)
                .instituteId(this.instituteId)
                .learnerInvitationId(this.learnerInvitation.getId())
                .status(this.status)
                .fullName(this.fullName)
                .email(this.email)
                .contactNumber(this.contactNumber)
                .batchOptionsJson(this.batchOptionsJson)
                .batchSelectionResponseJson(this.batchSelectionJson)
                .recordedOn(this.recordedOn)
                .customFieldsResponse(this.customFieldsResponse.stream().map(LearnerInvitationCustomFieldResponse::mapToDTO).collect(Collectors.toList()))
                .build();
    }
}
