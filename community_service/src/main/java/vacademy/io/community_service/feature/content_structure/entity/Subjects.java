package vacademy.io.community_service.feature.content_structure.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;

@Entity
@Getter
@Setter
@Table(name = "subjects")
public class Subjects {

    @Id
    @Column(name = "subject_id")
    private String subjectId;

    @Column(name = "subject_name", unique = true, nullable = false)
    private String subjectName;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "subject_chapter_mapping",
            joinColumns = @JoinColumn(name = "subject_id"),
            inverseJoinColumns = @JoinColumn(name = "chapter_id")
    )
    private Set<Chapter> chapters = new HashSet<>();
}
