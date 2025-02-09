package vacademy.io.admin_core_service.features.subject.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.student.Subject;

import java.sql.Timestamp;

@Entity
@Table(name = "subject_session", schema = "public")
@Getter
@Setter
@NoArgsConstructor
public class SubjectPackageSession {

    @Id
    @UuidGenerator
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private PackageSession packageSession;

    @Column(name = "subject_order")
    private Integer subjectOrder;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public SubjectPackageSession(Subject subject, PackageSession packageSession,Integer subjectOrder) {
        this.subject = subject;
        this.packageSession = packageSession;
        this.subjectOrder = subjectOrder;
    }
}
