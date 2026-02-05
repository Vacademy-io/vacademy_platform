package vacademy.io.admin_core_service.features.applicant.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.applicant.enums.ApplicantStageType;

import java.util.UUID;

@Entity
@Table(name = "application_stage")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicationStage {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private UUID id;

    @Column(name = "stage_name")
    private String stageName;

    @Column(name = "sequence")
    private String sequence;

    @Column(name = "source")
    private String source;

    @Column(name = "source_id")
    private String sourceId;

    @Column(name = "institute_id")
    private String instituteId;

    @Column(name = "config_json", columnDefinition = "TEXT")
    private String configJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "type")
    private ApplicantStageType type;
}
