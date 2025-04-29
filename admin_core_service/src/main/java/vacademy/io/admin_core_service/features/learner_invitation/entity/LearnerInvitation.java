package vacademy.io.admin_core_service.features.learner_invitation.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationDTO;

import java.sql.Date;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Entity
@Getter
@Setter
@Table(name = "learner_invitation")
public class LearnerInvitation {

    @Id
    @UuidGenerator
    private String id;

    private String name;
    private String status;

    private Date dateGenerated;
    private Date expiryDate;

    private String instituteId;
    private String inviteCode;

    private String batchOptionsJson;

    @OneToMany(mappedBy = "learnerInvitation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<LearnerInvitationCustomField> customFields = new ArrayList<>();

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public LearnerInvitation() {
    }

    public LearnerInvitation(LearnerInvitationDTO learnerInvitationDTO) {
        this.name = learnerInvitationDTO.getName();
        this.status = learnerInvitationDTO.getStatus();
        this.dateGenerated = new Date(System.currentTimeMillis());
        this.expiryDate = learnerInvitationDTO.getExpiryDate();
        this.instituteId = learnerInvitationDTO.getInstituteId();
        this.inviteCode = learnerInvitationDTO.getInviteCode();
        this.batchOptionsJson = learnerInvitationDTO.getBatchOptionsJson();

        if (Objects.nonNull(learnerInvitationDTO.getCustomFields())) {
            this.customFields = learnerInvitationDTO.getCustomFields()
                    .stream()
                    .filter(Objects::nonNull)
                    .map(fieldDTO -> new LearnerInvitationCustomField(fieldDTO, this))
                    .toList();
        }
    }

    public LearnerInvitationDTO mapToDTO() {
        return
                LearnerInvitationDTO
                        .builder()
                        .id(this.id)
                        .inviteCode(this.inviteCode)
                        .batchOptionsJson(this.batchOptionsJson)
                        .expiryDate(this.expiryDate)
                        .instituteId(this.instituteId)
                        .dateGenerated(this.dateGenerated)
                        .name(this.name)
                        .status(this.status)
                        .customFields(this.customFields.stream().map(LearnerInvitationCustomField::mapToDTO).toList())
                        .build();

    }

    public LearnerInvitationDTO mapToDTOWithCustomFields() {
        return
                LearnerInvitationDTO
                        .builder()
                        .id(this.id)
                        .inviteCode(this.inviteCode)
                        .batchOptionsJson(this.batchOptionsJson)
                        .expiryDate(this.expiryDate)
                        .instituteId(this.instituteId)
                        .dateGenerated(this.dateGenerated)
                        .name(this.name)
                        .status(this.status)
                        .build();

    }
}