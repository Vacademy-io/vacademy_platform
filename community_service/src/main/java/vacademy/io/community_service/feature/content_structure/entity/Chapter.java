package vacademy.io.community_service.feature.content_structure.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.HashSet;
import java.util.Set;

@Entity
@Data
@Table(name = "chapter")
public class Chapter {

    @Id
    @Column(name = "chapter_id")
    @UuidGenerator
    private String chapterId;

    @Column(name = "chapter_name", unique = true, nullable = false)
    private String chapterName;


    @Column(name = "chapter_order", nullable = false)
    private Integer chapterOrder;


    @ManyToMany(fetch = FetchType.LAZY)
    @JsonIgnore
    @JoinTable(
            name = "chapter_topic_mapping",
            joinColumns = @JoinColumn(name = "chapter_id"),
            inverseJoinColumns = @JoinColumn(name = "topic_id")
    )
    private Set<Topic> topics = new HashSet<>();

}
