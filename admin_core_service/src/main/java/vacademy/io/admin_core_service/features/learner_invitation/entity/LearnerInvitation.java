package vacademy.io.admin_core_service.features.learner_invitation.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationCodeDTO;

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

    public LearnerInvitation() {}

    public LearnerInvitation(LearnerInvitationCodeDTO learnerInvitationCodeDTO) {
        this.name = learnerInvitationCodeDTO.getName();
        this.status = learnerInvitationCodeDTO.getStatus();
        this.dateGenerated = new Date(System.currentTimeMillis());
        this.expiryDate = learnerInvitationCodeDTO.getExpiryDate();
        this.instituteId = learnerInvitationCodeDTO.getInstituteId();
        this.inviteCode = learnerInvitationCodeDTO.getInviteCode();
        this.batchOptionsJson = learnerInvitationCodeDTO.getBatchOptionsJson();

        if (Objects.nonNull(learnerInvitationCodeDTO.getCustomFields())) {
            this.customFields = learnerInvitationCodeDTO.getCustomFields()
                    .stream()
                    .filter(Objects::nonNull)
                    .map(fieldDTO -> new LearnerInvitationCustomField(fieldDTO, this))
                    .toList();
        }
    }
}
