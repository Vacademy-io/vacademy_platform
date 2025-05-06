package vacademy.io.admin_core_service.features.faculty.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
public class FacultySubjectPackageSessionMapping {
    @Id
    @UuidGenerator
    private String id;
    private String userId;
    private String packageSessionId;
    private String subjectId;
    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public FacultySubjectPackageSessionMapping() {}

    public FacultySubjectPackageSessionMapping(String userId, String packageSessionId, String subjectId) {
        this.userId = userId;
        this.packageSessionId = packageSessionId;
        this.subjectId = subjectId;
    }
}
