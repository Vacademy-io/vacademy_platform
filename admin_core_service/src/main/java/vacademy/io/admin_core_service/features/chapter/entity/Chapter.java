package vacademy.io.admin_core_service.features.chapter.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTO;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;

import java.sql.Timestamp;

@Entity
@Table(name = "chapter")
@Getter
@Setter
public class Chapter {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "chapter_name")
    private String chapterName;

    @Column(name = "status")
    private String status;

    @Column(name = "file_id")
    private String fileId;

    @Column(name = "description")
    private String description;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    @Column(name = "parent_id")
    private String parentId;

    @Column(name = "created_by_user_id")
    private String createdByUserId;

    public Chapter(ChapterDTO chapterDTO) {
        if (chapterDTO.getId() != null) {
            this.id = chapterDTO.getId();
        }
        if (chapterDTO.getChapterName() != null) {
            this.chapterName = chapterDTO.getChapterName();
        }
        if (chapterDTO.getFileId() != null) {
            this.fileId = chapterDTO.getFileId();
        }
        if (chapterDTO.getDescription() != null) {
            this.description = chapterDTO.getDescription();
        }
        this.status = ChapterStatus.ACTIVE.name();
    }

    public Chapter() {
    }

    public ChapterDTO mapToDTO() {
        ChapterDTO chapterDTO = new ChapterDTO();
        chapterDTO.setId(id);
        chapterDTO.setChapterName(chapterName);
        chapterDTO.setFileId(fileId);
        chapterDTO.setDescription(description);
        chapterDTO.setStatus(status);
        chapterDTO.setParentId(parentId);
        return chapterDTO;
    }

}
