package vacademy.io.admin_core_service.features.chapter.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

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
    private String statues;

    @Column(name = "file_id")
    private String fileId;

    @Column(name = "description")
    private String description;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

}
