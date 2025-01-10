package vacademy.io.admin_core_service.features.subject.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.student.Subject;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;


import java.sql.Timestamp;

@Entity
@Table(name = "subject_chapter_module_and_package_session_mapping")
public class SubjectChapterModuleAndPackageSessionMapping {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false)
    private String id;

    @ManyToOne
    @JoinColumn(name = "subject_id", nullable = false) // Foreign key for subject_id
    private Subject subject;

    @ManyToOne
    @JoinColumn(name = "chapter_id", nullable = false) // Foreign key for chapter_id
    private Chapter chapter;

    @ManyToOne
    @JoinColumn(name = "module_id") // Foreign key for module_id (nullable)
    private Module modaaule;

    @ManyToOne
    @JoinColumn(name = "package_session_id") // Foreign key for package_session_id (nullable)
    private PackageSession packageSession;

    @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp updatedAt;

}