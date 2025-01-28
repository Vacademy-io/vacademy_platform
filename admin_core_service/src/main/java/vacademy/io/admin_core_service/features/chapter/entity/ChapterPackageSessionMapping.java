package vacademy.io.admin_core_service.features.chapter.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.sql.Timestamp;

@Entity
@Table(name = "chapter_package_session_mapping")
@Getter
@Setter
public class ChapterPackageSessionMapping {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @ManyToOne
    @JoinColumn(name = "chapter_id", referencedColumnName = "id", nullable = false)
    private Chapter chapter;

    @ManyToOne
    @JoinColumn(name = "package_session_id", referencedColumnName = "id", nullable = false)
    private PackageSession packageSession;

    @Column(name = "status")
    private String status;

    @Column(name = "chapter_order")
    private Integer chapterOrder;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public ChapterPackageSessionMapping(Chapter chapter, PackageSession packageSession,Integer chapterOrder) {
        this.chapter = chapter;
        this.packageSession = packageSession;
        this.status = ChapterStatus.ACTIVE.name();
        this.chapterOrder = chapterOrder;
    }

    public ChapterPackageSessionMapping() {}
}
