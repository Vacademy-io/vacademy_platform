package vacademy.io.community_service.feature.content_structure.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

import java.util.Set;

@Entity
@Data
@Table(name = "streams")
public class Streams {
    @Id
    @Column(name = "stream_id")
    private String streamId;

    @Column(name = "stream_name", unique = true, nullable = false)
    private String streamName;

//    @ManyToMany(mappedBy = "streams")
//    private Set<Levels> levels;

    @ManyToMany
    @JsonIgnore
    @JoinTable(
            name = "stream_subject_mapping",
            joinColumns = @JoinColumn(name = "stream_id"),
            inverseJoinColumns = @JoinColumn(name = "subject_id")
    )
    private Set<Subjects> subjects;
}
