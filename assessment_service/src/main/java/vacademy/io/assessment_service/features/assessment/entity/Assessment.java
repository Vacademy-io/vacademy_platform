package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldNameConstants;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;

import java.util.Date;
import java.util.List;

@Entity
@Table(name = "assessment")
@Builder
@Getter
@Setter
@EqualsAndHashCode(of = "id")
@NoArgsConstructor
@AllArgsConstructor
public class Assessment {
    
    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;
    
    @Column(name = "name", nullable = false)
    private String name;
    
    @Column(name = "about_id")
    private String aboutId;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "instructions_id", referencedColumnName = "id", insertable = true, updatable = true)
    private AssessmentRichTextData instructions;
    
    @Column(name = "play_mode", nullable = false)
    private String playMode;
    
    @Column(name = "evaluation_type", nullable = false)
    private String evaluationType;

    @Column(name = "submission_type", nullable = false)
    private String submissionType;
    
    @Column(name = "duration")
    private Integer duration;

    @Column(name = "preview_time")
    private Integer previewTime;
    
    @Column(name = "duration_distribution", nullable = false)
    private String durationDistribution;
    
    @Column(name = "can_switch_section", nullable = false)
    private Boolean canSwitchSection;

    @Column(name = "can_request_reattempt", nullable = false)
    private Boolean canRequestReattempt;

    @Column(name = "can_request_time_increase", nullable = false)
    private Boolean canRequestTimeIncrease;
    
    @Column(name = "assessment_visibility", nullable = false)
    private String assessmentVisibility;

    @Column(name = "status", nullable = true)
    private String status;
    
    @Column(name = "registration_close_date")
    private Date registrationCloseDate;
    
    @Column(name = "registration_open_date")
    private Date registrationOpenDate;
    
    @Column(name = "expected_participants")
    private Integer expectedParticipants;
    
    @Column(name = "cover_file_id")
    private Integer coverFileId;
    
    @Column(name = "bound_start_time")
    private Date boundStartTime;
    
    @Column(name = "bound_end_time")
    private Date boundEndTime;
    
    @OneToMany(mappedBy = "assessment")
    private List<Section> sections;
    
    @OneToMany(mappedBy = "assessment", fetch = FetchType.LAZY)
    private List<AssessmentUserRegistration> userRegistrations;

    @OneToMany(mappedBy = "assessment", fetch = FetchType.LAZY)
    private List<AssessmentBatchRegistration> batchRegistrations;

    @OneToMany(mappedBy = "assessment")
    private List<AssessmentCustomField> assessmentCustomFields;
    
    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;
    
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}