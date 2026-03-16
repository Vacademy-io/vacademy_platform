package vacademy.io.admin_core_service.features.institute_learner.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.institute.entity.Institute;

import java.sql.Timestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "student_sub_org")
public class StudentSubOrg {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "student_id", nullable = false)
    private String studentId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "sub_org_id", nullable = false, insertable = false, updatable = false)
    private String subOrgId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sub_org_id", nullable = false)
    private Institute subOrg;

    @Column(name = "link_type", nullable = false)
    private String linkType;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public StudentSubOrg(String studentId, String userId, Institute subOrg, String linkType) {
        this.studentId = studentId;
        this.userId = userId;
        this.subOrg = subOrg;
        this.linkType = linkType;
        this.status = "ACTIVE";
    }
}
