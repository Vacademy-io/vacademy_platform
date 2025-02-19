package vacademy.io.admin_core_service.features.module.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.common.institute.entity.module.Module;

import java.sql.Timestamp;

@Entity
@Table(name = "module_chapter_mapping")
public class ModuleChapterMapping {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @ManyToOne
    @JoinColumn(name = "chapter_id", referencedColumnName = "id", nullable = false)
    private Chapter chapter;

    @ManyToOne
    @JoinColumn(name = "module_id", referencedColumnName = "id", nullable = false)
    private Module module;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public ModuleChapterMapping() {
    }

    public ModuleChapterMapping(Chapter chapter, Module module) {
        this.chapter = chapter;
        this.module = module;
    }
}
