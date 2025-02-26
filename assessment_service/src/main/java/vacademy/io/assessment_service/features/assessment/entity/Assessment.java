package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;

import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "about_id", referencedColumnName = "id", insertable = true, updatable = true)
    private AssessmentRichTextData about;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "instructions_id", referencedColumnName = "id", insertable = true, updatable = true)
    private AssessmentRichTextData instructions;

    @Column(name = "play_mode", nullable = false)
    private String playMode;

    @Column(name = "evaluation_type", nullable = false)
    private String evaluationType;

    @Column(name = "submission_type", nullable = false)
    private String submissionType;

    @Column(name = "source")
    private String source;

    @Column(name = "sourceId")
    private String sourceId;

    @Column(name = "duration")
    private Integer duration;

    @Column(name = "preview_time")
    private Integer previewTime;

    @Column(name = "duration_distribution")
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

    @Column(name = "omr_mode")
    private Boolean omrMode;

    @Column(name = "reattempt_count")
    private Integer reattemptCount;

    @OneToMany(mappedBy = "assessment")
    @Filter(name = "activeSections", condition = "active = :active")
    private Set<Section> sections = new HashSet<>();

    @OneToMany(mappedBy = "assessment", fetch = FetchType.LAZY)
    private Set<AssessmentUserRegistration> userRegistrations = new HashSet<>();

    @OneToMany(mappedBy = "assessment", fetch = FetchType.LAZY)
    private Set<AssessmentBatchRegistration> batchRegistrations = new HashSet<>();

    @OneToMany(mappedBy = "assessment", fetch = FetchType.LAZY)
    private Set<AssessmentCustomField> assessmentCustomFields = new HashSet<>();

    @OneToMany(mappedBy = "assessment", fetch = FetchType.LAZY)
    private Set<AssessmentInstituteMapping> assessmentInstituteMappings = new HashSet<>();

    @OneToOne(mappedBy = "assessment")
    private AssessmentNotificationMetadata assessmentNotificationMetadata;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}